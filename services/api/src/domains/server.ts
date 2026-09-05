import { randomBytes } from "node:crypto";

import { and, count, eq, or, sql } from "drizzle-orm";

import type { Database } from "@repo/database";
import { domains } from "@repo/database/schema/domains";
import {
  workspaces,
  workspaceMembers,
} from "@repo/database/schema/workspaces";

import {
  assertCanCreateDomain,
  assertCanCreateWorkspace,
  getPlanLimits,
  planSchema,
} from "@repo/api/plans";
import {
  createDomainSchema,
  domainIdSchema,
  updateDomainSchema,
  type CreateDomainInput,
  type UpdateDomainInput,
} from "@repo/api/domains/schemas";

export type SessionWithUser = {
  user: { id: string };
} | null;

export class DomainServiceError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "DomainServiceError";
  }
}

const unauthorized = () =>
  new DomainServiceError(401, "UNAUTHORIZED", "You must be signed in");

const forbidden = () =>
  new DomainServiceError(403, "FORBIDDEN", "You do not have access to this domain");

const forbiddenMutation = () =>
  new DomainServiceError(
    403,
    "FORBIDDEN",
    "Only workspace owners, admins, and members can modify domains",
  );

const notFound = () =>
  new DomainServiceError(404, "NOT_FOUND", "Domain not found");

const conflict = (field: string) =>
  new DomainServiceError(
    409,
    "CONFLICT",
    `A domain with this ${field} already exists`,
  );

/**
 * Workspace-aware domain CRUD. Access is granted to:
 *  - The domain owner directly
 *  - Any user who shares a workspace with the domain owner
 * Mutations (create/update/delete) additionally require owner/admin/member role.
 */
export function createDomainsService(deps: {
  db: Database;
  getSession: (headers: Headers) => Promise<SessionWithUser>;
}) {
  const { db, getSession } = deps;

  /**
   * Returns the domain if the session user has access (owner or workspace member).
   * Also returns the user's workspace role for mutation gating.
   */
  const requireDomainAccess = async (
    id: string,
    headers: Headers,
  ): Promise<
    NonNullable<SessionWithUser> & {
      domain: typeof domains.$inferSelect;
      workspaceRole: string | null;
    }
  > => {
    const session = await getSession(headers);
    if (!session) throw unauthorized();

    // Fetch domain + check workspace membership in one query
    const [row] = await db
      .select({
        domain: domains,
        workspaceRole: workspaceMembers.role,
      })
      .from(domains)
      .leftJoin(
        workspaceMembers,
        and(
          eq(workspaceMembers.userId, session.user.id),
          sql`EXISTS (
            SELECT 1 FROM ${workspaceMembers} AS wm
            WHERE wm.user_id = ${domains.ownerId}
              AND wm.workspace_id = ${workspaceMembers.workspaceId}
          )`,
        ),
      )
      .where(eq(domains.id, id))
      .limit(1);

    if (!row) throw notFound();

    // Direct owner always has full access
    const isOwner = row.domain.ownerId === session.user.id;
    if (!isOwner && !row.workspaceRole) throw forbidden();

    return {
      ...session,
      domain: row.domain,
      workspaceRole: isOwner ? "owner" : row.workspaceRole,
    };
  };

  /**
   * Checks if the user's workspace role allows mutations.
   * owner / admin / member can mutate. viewer cannot.
   */
  const requireMutationAccess = (
    workspaceRole: string | null,
    isOwner: boolean,
  ) => {
    if (isOwner) return; // domain owner can always mutate
    if (
      workspaceRole === "owner" ||
      workspaceRole === "admin" ||
      workspaceRole === "member"
    )
      return;
    throw forbiddenMutation();
  };

  return {
    /** Lists domains the session user can access (owner or workspace member). */
    listDomains: async (headers: Headers) => {
      const session = await getSession(headers);
      if (!session) throw unauthorized();

      // Subquery: workspace IDs the user belongs to
      const userWorkspaceIds = db
        .select({ workspaceId: workspaceMembers.workspaceId })
        .from(workspaceMembers)
        .where(eq(workspaceMembers.userId, session.user.id))
        .as("user_ws_ids");

      // Subquery: user IDs who share a workspace with the session user
      const workspacePeerIds = db
        .select({ userId: workspaceMembers.userId })
        .from(workspaceMembers)
        .innerJoin(
          userWorkspaceIds,
          eq(workspaceMembers.workspaceId, userWorkspaceIds.workspaceId),
        )
        .as("ws_peer_ids");

      return db
        .select()
        .from(domains)
        .where(
          or(
            eq(domains.ownerId, session.user.id),
            sql`${domains.ownerId} IN (SELECT user_id FROM ${workspacePeerIds})`,
          ),
        )
        .orderBy(domains.createdAt);
    },

    /** Returns a single domain if the session user has access. */
    getDomain: async (id: string, headers: Headers) => {
      const { domain } = await requireDomainAccess(id, headers);
      return domain;
    },

    /** Creates a domain owned by the session user (subject to plan limits). */
    createDomain: async (input: CreateDomainInput, headers: Headers) => {
      const session = await getSession(headers);
      if (!session) throw unauthorized();

      const body = createDomainSchema.parse(input);

      const [existing] = await db
        .select({ id: domains.id })
        .from(domains)
        .where(eq(domains.slug, body.slug))
        .limit(1);
      if (existing) throw conflict("slug");

      const plan = planSchema.parse("free");
      const [row] = await db
        .select({ count: count() })
        .from(domains)
        .where(eq(domains.ownerId, session.user.id));
      assertCanCreateDomain(getPlanLimits(plan), row?.count ?? 0);

      // Auto-create workspace if user doesn't have one
      const [existingMembership] = await db
        .select({ workspaceId: workspaceMembers.workspaceId })
        .from(workspaceMembers)
        .where(eq(workspaceMembers.userId, session.user.id))
        .limit(1);

      let workspaceId = existingMembership?.workspaceId;

      if (!workspaceId) {
        // Check workspace creation limit
        const [workspaceCountRow] = await db
          .select({ count: count() })
          .from(workspaceMembers)
          .where(eq(workspaceMembers.userId, session.user.id));
        assertCanCreateWorkspace(
          getPlanLimits(plan),
          workspaceCountRow?.count ?? 0,
        );

        // Create workspace
        const [createdWorkspace] = await db
          .insert(workspaces)
          .values({
            name: `${session.user.id.slice(0, 8)}'s workspace`,
            ownerId: session.user.id,
          })
          .returning();

        if (!createdWorkspace) {
          throw new DomainServiceError(
            500,
            "CREATE_FAILED",
            "Failed to create workspace",
          );
        }

        // Add user as workspace owner
        await db.insert(workspaceMembers).values({
          workspaceId: createdWorkspace.id,
          userId: session.user.id,
          role: "owner",
        });

        workspaceId = createdWorkspace.id;
      }

      const [created] = await db
        .insert(domains)
        .values({
          ownerId: session.user.id,
          name: body.name,
          slug: body.slug,
          logoUrl: body.logoUrl ?? null,
          businessType: body.businessType ?? null,
          embedSecret: randomBytes(32).toString("hex"),
          plan,
        })
        .returning();

      return created;
    },

    /** Renames a domain (requires owner/admin/member workspace role). */
    updateDomain: async (
      id: string,
      input: UpdateDomainInput,
      headers: Headers,
    ) => {
      const body = updateDomainSchema.parse(input);
      const { domain, workspaceRole } = await requireDomainAccess(id, headers);
      const isOwner = domain.ownerId === (await getSession(headers))?.user.id;
      requireMutationAccess(workspaceRole, isOwner);

      if (body.slug && body.slug !== domain.slug) {
        const [existing] = await db
          .select({ id: domains.id })
          .from(domains)
          .where(eq(domains.slug, body.slug))
          .limit(1);
        if (existing) throw conflict("slug");
      }

      const [updated] = await db
        .update(domains)
        .set({
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.slug !== undefined ? { slug: body.slug } : {}),
          ...(body.businessType !== undefined
            ? { businessType: body.businessType }
            : {}),
          updatedAt: new Date(),
        })
        .where(eq(domains.id, domain.id))
        .returning();

      return updated;
    },

    /** Deletes a domain (requires owner/admin/member workspace role). */
    deleteDomain: async (id: string, headers: Headers) => {
      domainIdSchema.parse({ id });
      const { domain, workspaceRole } = await requireDomainAccess(id, headers);
      const isOwner = domain.ownerId === (await getSession(headers))?.user.id;
      requireMutationAccess(workspaceRole, isOwner);

      await db.delete(domains).where(eq(domains.id, domain.id));
    },

    /**
     * Owner-only embed configuration: the widget script URL plus the domain
     * secret used by the (P3) public chat endpoint.
     */
    getEmbedConfig: async (id: string, headers: Headers) => {
      const { domain } = await requireDomainAccess(id, headers);
      const baseUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

      return {
        slug: domain.slug,
        widgetUrl: `${baseUrl}/widget.js`,
        secret: domain.embedSecret,
      };
    },
  };
}

export type DomainsService = ReturnType<typeof createDomainsService>;
