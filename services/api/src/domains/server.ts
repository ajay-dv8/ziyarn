import { randomBytes } from "node:crypto";

import { count, eq } from "drizzle-orm";

import type { Database } from "@repo/database";
import { domains } from "@repo/database/schema/domains";
import {
  workspaces,
  workspaceMembers,
} from "@repo/database/schema/workspaces";

import {
  PlanLimitError,
  assertCanCreateDomain,
  assertCanCreateWorkspace,
  clampWidgetVariantForPlan,
  getPlanLimits,
  planAllowsWidgetVariant,
  planSchema,
} from "@repo/api/plans";
import {
  createDomainSchema,
  domainIdSchema,
  updateDomainSchema,
  type CreateDomainInput,
  type UpdateDomainInput,
} from "@repo/api/domains/schemas";
import { DEFAULT_WIDGET_VARIANT } from "@repo/api/domains/widget-variants";
import {
  resolveChatTrigger,
  resolveChatTriggerConfig,
} from "@repo/api/domains/chat-triggers";
import {
  parseDomainLocations,
  resolveDomainLocations,
} from "@repo/api/domains/locations";
import type { WorkspaceRole } from "@repo/api/workspaces/roles";
import { resolveActiveWorkspaceId } from "@repo/api/workspaces/active";
import {
  findDomainAccess,
  findWorkspaceRole,
  roleCanEditDomainData,
} from "@repo/api/workspaces/access";
import { resolveWorkspacePlan } from "@repo/api/workspaces/plan";

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
 * Workspace-scoped domain CRUD. Access is granted to members of the domain's
 * workspace — `ownerId` records who created the domain, it is not an access
 * grant. Mutations additionally require the owner/admin/member role; viewers
 * can read only.
 */
export function createDomainsService(deps: {
  db: Database;
  getSession: (headers: Headers) => Promise<SessionWithUser>;
}) {
  const { db, getSession } = deps;

  /**
   * Returns the domain if the session user is a member of the workspace it
   * belongs to. Also returns that membership's role for mutation gating.
   */
  const requireDomainAccess = async (
    id: string,
    headers: Headers,
  ): Promise<
    NonNullable<SessionWithUser> & {
      domain: typeof domains.$inferSelect;
      workspaceRole: WorkspaceRole;
    }
  > => {
    const session = await getSession(headers);
    if (!session) throw unauthorized();

    const access = await findDomainAccess(db, id, session.user.id);
    if (access.kind === "not_found") throw notFound();
    if (access.kind === "forbidden") throw forbidden();

    return {
      ...session,
      domain: access.domain,
      workspaceRole: access.role,
    };
  };

  /** owner / admin / member can mutate; viewer cannot. */
  const requireMutationAccess = (workspaceRole: WorkspaceRole) => {
    if (roleCanEditDomainData(workspaceRole)) return;
    throw forbiddenMutation();
  };

  return {
    /**
     * Lists the domains in the active workspace. The cookie only expresses
     * intent; membership is checked server-side and the user's first
     * workspace is the fallback.
     */
    listDomains: async (headers: Headers) => {
      const session = await getSession(headers);
      if (!session) throw unauthorized();

      const workspaceId = await resolveActiveWorkspaceId(
        db,
        headers,
        session.user.id,
      );
      if (!workspaceId) return [];

      return db
        .select()
        .from(domains)
        .where(eq(domains.workspaceId, workspaceId))
        .orderBy(domains.createdAt)
        .then((rows) =>
          rows.map((row) => ({
            ...row,
            // Narrowed here, not cast at the call sites: a row holding a
            // retired variant id must never reach the UI as an unvalidated
            // string. Then clamped to the plan, so a domain whose plan does
            // not include its widget reports the one it may actually use.
            widgetVariant: clampWidgetVariantForPlan(
              planSchema.parse(row.plan),
              row.widgetVariant,
            ),
            // Same doctrine for the chat trigger: unknown ids fail open to
            // the default and the customization bag always has its keys.
            chatTrigger: resolveChatTrigger(row.chatTrigger),
            chatTriggerConfig: resolveChatTriggerConfig(
              row.chatTriggerConfig,
            ),
            locations: resolveDomainLocations(row.locations),
          })),
        );
    },

    /** Returns a single domain if the session user has access. */
    getDomain: async (id: string, headers: Headers) => {
      const { domain } = await requireDomainAccess(id, headers);
      return {
        ...domain,
        widgetVariant: clampWidgetVariantForPlan(
          planSchema.parse(domain.plan),
          domain.widgetVariant,
        ),
        chatTrigger: resolveChatTrigger(domain.chatTrigger),
        chatTriggerConfig: resolveChatTriggerConfig(domain.chatTriggerConfig),
        locations: resolveDomainLocations(domain.locations),
      };
    },

    /** Creates a domain in the active workspace, created by the session user. */
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

      let workspaceId = await resolveActiveWorkspaceId(
        db,
        headers,
        session.user.id,
      );

      // First domain for a brand-new user: give them a workspace first. The
      // fallback plan is free because no workspace exists yet to resolve one.
      if (!workspaceId) {
        const [workspaceCountRow] = await db
          .select({ count: count() })
          .from(workspaceMembers)
          .where(eq(workspaceMembers.userId, session.user.id));
        assertCanCreateWorkspace(
          getPlanLimits("free"),
          workspaceCountRow?.count ?? 0,
        );

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

        await db.insert(workspaceMembers).values({
          workspaceId: createdWorkspace.id,
          userId: session.user.id,
          role: "owner",
        });

        workspaceId = createdWorkspace.id;
      }

      const workspaceRole = await findWorkspaceRole(
        db,
        workspaceId,
        session.user.id,
      );
      if (!workspaceRole) throw forbidden();
      requireMutationAccess(workspaceRole);

      const plan = await resolveWorkspacePlan(db, workspaceId);
      const [domainCountRow] = await db
        .select({ count: count() })
        .from(domains)
        .where(eq(domains.workspaceId, workspaceId));
      assertCanCreateDomain(getPlanLimits(plan), domainCountRow?.count ?? 0);

      // A plan that does not include the requested widget gets the first one
      // it does include, rather than refusing to create the domain.
      const widgetVariant = clampWidgetVariantForPlan(
        plan,
        body.widgetVariant ?? DEFAULT_WIDGET_VARIANT,
      );

      const [created] = await db
        .insert(domains)
        .values({
          ownerId: session.user.id,
          workspaceId,
          name: body.name,
          slug: body.slug,
          logoUrl: body.logoUrl ?? null,
          businessType: body.businessType ?? null,
          widgetVariant,
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
      requireMutationAccess(workspaceRole);

      if (body.slug && body.slug !== domain.slug) {
        const [existing] = await db
          .select({ id: domains.id })
          .from(domains)
          .where(eq(domains.slug, body.slug))
          .limit(1);
        if (existing) throw conflict("slug");
      }

      // Switching to a widget the plan does not include is refused rather
      // than silently ignored: the owner picked it, and the picker is the
      // place that explains the plan does not include it.
      const domainPlan = planSchema.parse(domain.plan);
      if (
        body.widgetVariant !== undefined &&
        !planAllowsWidgetVariant(domainPlan, body.widgetVariant)
      ) {
        throw new PlanLimitError(
          403,
          "WIDGET_NOT_INCLUDED",
          `The ${body.widgetVariant} widget is not included in the ${domainPlan} plan`,
        );
      }

      const locations =
        body.locations !== undefined
          ? parseDomainLocations(body.locations)
          : undefined;

      const [updated] = await db
        .update(domains)
        .set({
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.slug !== undefined ? { slug: body.slug } : {}),
          ...(body.logoUrl !== undefined ? { logoUrl: body.logoUrl } : {}),
          ...(body.businessType !== undefined
            ? { businessType: body.businessType }
            : {}),
          ...(body.widgetVariant !== undefined
            ? { widgetVariant: body.widgetVariant }
            : {}),
          ...(body.chatTrigger !== undefined
            ? { chatTrigger: body.chatTrigger }
            : {}),
          ...(body.chatTriggerConfig !== undefined
            ? { chatTriggerConfig: body.chatTriggerConfig }
            : {}),
          ...(locations !== undefined ? { locations } : {}),
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
      requireMutationAccess(workspaceRole);

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
        // Emitted into the embed snippet as data-variant. Every variant is
        // delivered by widget.js; Modern Sleek's script mounts the iframe that
        // hosts its React surface. Normalised so a row holding a retired
        // variant id still produces a working snippet, and clamped to the
        // domain's plan so a downgraded account never serves a widget it no
        // longer includes.
        variant: clampWidgetVariantForPlan(
          planSchema.parse(domain.plan),
          domain.widgetVariant,
        ),
      };
    },
  };
}

export type DomainsService = ReturnType<typeof createDomainsService>;
