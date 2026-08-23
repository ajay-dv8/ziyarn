import { and, desc, eq, ilike, or, sql } from "drizzle-orm";

import type { Database } from "@repo/database";
import {
  agents,
  conversations,
  customers,
  domains,
  leads,
} from "@repo/database/schema";
import type { SessionWithUser } from "@repo/api/domains/server";
import {
  type CustomerSource,
  type ImportCustomersInput,
  type ListCustomersInput,
} from "@repo/api/customers/schemas";

export class CustomersServiceError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "CustomersServiceError";
  }
}

const unauthorized = () =>
  new CustomersServiceError(401, "UNAUTHORIZED", "You must be signed in");
const forbidden = () =>
  new CustomersServiceError(403, "FORBIDDEN", "You do not own this domain");
const domainNotFound = () =>
  new CustomersServiceError(404, "DOMAIN_NOT_FOUND", "Domain not found");

export type CustomerRow = {
  email: string;
  name?: string | null;
};

/** Internal: no session — callers have already verified ownership. */
export function upsertCustomers(
  db: Database,
  input: {
    domainId: string;
    source: CustomerSource;
    rows: CustomerRow[];
    sourceLabel?: string | null;
    conversationId?: string | null;
  },
): Promise<number> {
  const seen = new Set<string>();
  const values = [];
  for (const row of input.rows) {
    const email = row.email?.trim().toLowerCase();
    if (!email || !email.includes("@") || seen.has(email)) continue;
    seen.add(email);
    values.push({
      domainId: input.domainId,
      email,
      emailLower: email,
      name: row.name?.trim() || null,
      source: input.source,
      sourceLabel: input.sourceLabel ?? null,
      conversationId: input.conversationId ?? null,
    });
  }
  if (values.length === 0) return Promise.resolve(0);

  return (async () => {
    // First provenance wins: existing rows keep their original source; we
    // only backfill a missing name on later sightings.
    const inserted = await db
      .insert(customers)
      .values(values)
      .onConflictDoUpdate({
        target: [customers.domainId, customers.emailLower],
        set: {
          name: sql`coalesce(${customers.name}, excluded.name)`,
          updatedAt: new Date(),
        },
      })
      .returning({ id: customers.id });
    return inserted.length;
  })();
}

export function createCustomersService(deps: {
  db: Database;
  getSession: (headers: Headers) => Promise<SessionWithUser>;
}) {
  const { db, getSession } = deps;

  const requireOwnedDomain = async (
    domainId: string,
    headers: Headers,
  ): Promise<NonNullable<SessionWithUser>> => {
    const session = await getSession(headers);
    if (!session) throw unauthorized();

    const [domain] = await db
      .select({ id: domains.id, ownerId: domains.ownerId })
      .from(domains)
      .where(eq(domains.id, domainId))
      .limit(1);
    if (!domain) throw domainNotFound();
    if (domain.ownerId !== session.user.id) throw forbidden();
    return session;
  };

  return {
    /** Lists a domain's customers with per-source counts. */
    list: async (input: ListCustomersInput, headers: Headers) => {
      await requireOwnedDomain(input.domainId, headers);

      const conditions = [eq(customers.domainId, input.domainId)];
      if (input.source) conditions.push(eq(customers.source, input.source));
      if (input.q) {
        const pattern = `%${input.q}%`;
        const match = or(
          ilike(customers.email, pattern),
          ilike(customers.name, pattern),
        );
        if (match) conditions.push(match);
      }

      const rows = await db
        .select()
        .from(customers)
        .where(and(...conditions))
        .orderBy(desc(customers.createdAt))
        .limit(500);

      const grouped = await db
        .select({
          source: customers.source,
          count: sql<number>`count(*)::int`,
        })
        .from(customers)
        .where(eq(customers.domainId, input.domainId))
        .groupBy(customers.source);

      const counts: Record<CustomerSource | "all", number> = {
        all: 0,
        chat: 0,
        database: 0,
        site: 0,
      };
      for (const row of grouped) {
        counts[row.source] = row.count;
        counts.all += row.count;
      }

      return { customers: rows, counts };
    },

    /**
     * Imports subscriber rows uploaded by the owner (site subscribers,
     * exported lists). Deduplicates against the domain's customers.
     */
    import: async (input: ImportCustomersInput, headers: Headers) => {
      await requireOwnedDomain(input.domainId, headers);
      const inserted = await upsertCustomers(db, {
        domainId: input.domainId,
        source: "site",
        sourceLabel: "Imported list",
        rows: input.rows,
      });
      return { imported: inserted };
    },

    /**
     * One-click migration: turns every chat-captured lead of the domain
     * into a customer row. Safe to run repeatedly.
     */
    backfillFromLeads: async (
      input: { domainId: string },
      headers: Headers,
    ) => {
      await requireOwnedDomain(input.domainId, headers);

      const leadRows = await db
        .select({
          email: leads.email,
          name: leads.name,
          conversationId: leads.conversationId,
        })
        .from(leads)
        .innerJoin(conversations, eq(conversations.id, leads.conversationId))
        .innerJoin(agents, eq(agents.id, conversations.agentId))
        .where(eq(agents.domainId, input.domainId));

      const inserted = await upsertCustomers(db, {
        domainId: input.domainId,
        source: "chat",
        rows: leadRows.map((lead) => ({
          email: lead.email ?? "",
          name: lead.name,
        })),
        conversationId: undefined,
      });
      return { imported: inserted };
    },
  };
}

export type CustomersService = ReturnType<typeof createCustomersService>;
