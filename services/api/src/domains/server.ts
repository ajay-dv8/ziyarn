import { randomBytes } from "node:crypto";

import { count, eq } from "drizzle-orm";

import type { Database } from "@repo/database";
import { domains } from "@repo/database/schema/domains";

import {
  assertCanCreateDomain,
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
  new DomainServiceError(403, "FORBIDDEN", "You do not own this domain");

const notFound = () =>
  new DomainServiceError(404, "NOT_FOUND", "Domain not found");

const conflict = (field: string) =>
  new DomainServiceError(
    409,
    "CONFLICT",
    `A domain with this ${field} already exists`,
  );

/**
 * Owner-scoped domain CRUD. Every mutation verifies the domain belongs to
 * the session user before touching the row.
 */
export function createDomainsService(deps: {
  db: Database;
  getSession: (headers: Headers) => Promise<SessionWithUser>;
}) {
  const { db, getSession } = deps;

  const requireOwnedDomain = async (
    id: string,
    headers: Headers,
  ): Promise<NonNullable<SessionWithUser> & { domain: typeof domains.$inferSelect }> => {
    const session = await getSession(headers);
    if (!session) throw unauthorized();

    const [domain] = await db
      .select()
      .from(domains)
      .where(eq(domains.id, id))
      .limit(1);

    if (!domain) throw notFound();
    if (domain.ownerId !== session.user.id) throw forbidden();

    return { ...session, domain };
  };

  return {
    /** Lists domains owned by the session user, newest first. */
    listDomains: async (headers: Headers) => {
      const session = await getSession(headers);
      if (!session) throw unauthorized();

      return db
        .select()
        .from(domains)
        .where(eq(domains.ownerId, session.user.id))
        .orderBy(domains.createdAt);
    },

    /** Returns a single domain if the session user owns it. */
    getDomain: async (id: string, headers: Headers) => {
      const { domain } = await requireOwnedDomain(id, headers);
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

      const [created] = await db
        .insert(domains)
        .values({
          ownerId: session.user.id,
          name: body.name,
          slug: body.slug,
          embedSecret: randomBytes(32).toString("hex"),
          plan,
        })
        .returning();

      return created;
    },

    /** Renames a domain owned by the session user. */
    updateDomain: async (
      id: string,
      input: UpdateDomainInput,
      headers: Headers,
    ) => {
      const body = updateDomainSchema.parse(input);
      const { domain } = await requireOwnedDomain(id, headers);

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
          updatedAt: new Date(),
        })
        .where(eq(domains.id, domain.id))
        .returning();

      return updated;
    },

    /** Deletes a domain owned by the session user. */
    deleteDomain: async (id: string, headers: Headers) => {
      domainIdSchema.parse({ id });
      const { domain } = await requireOwnedDomain(id, headers);

      await db.delete(domains).where(eq(domains.id, domain.id));
    },

    /**
     * Owner-only embed configuration: the widget script URL plus the domain
     * secret used by the (P3) public chat endpoint.
     */
    getEmbedConfig: async (id: string, headers: Headers) => {
      const { domain } = await requireOwnedDomain(id, headers);
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
