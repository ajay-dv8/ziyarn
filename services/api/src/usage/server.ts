import { and, count, eq, gte, inArray, lt, sql } from "drizzle-orm";

import type { Database } from "@repo/database";
import {
  agents,
  campaigns,
  conversations,
  domains,
  messages,
  subscriptions,
} from "@repo/database/schema";

import { getPlanLimits } from "@repo/api/plans";
import type { Plan } from "@repo/api/plans/schemas";
import {
  usagePeriodSchema,
  type UsagePeriodInput,
  type UsageSummary,
} from "@repo/api/usage/schemas";

export class UsageServiceError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "UsageServiceError";
  }
}

const unauthorized = () =>
  new UsageServiceError(401, "UNAUTHORIZED", "You must be signed in");

const invalidPeriod = () =>
  new UsageServiceError(400, "INVALID_PERIOD", "Period must look like 2026-06");

/** First instant of a local month, e.g. "2026-06" -> 2026-06-01 00:00. */
function monthRange(period: string): { start: Date; end: Date } {
  const [year, month] = period.split("-").map(Number);
  if (!year || !month || month < 1 || month > 12) {
    throw invalidPeriod();
  }
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);
  return { start, end };
}

function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Owner-scoped usage metering: conversations, AI messages and marketing
 * emails consumed in a month, aggregated live from the source tables (no
 * ledger drift). Plan limits come from the single plans module.
 */
export function createUsageService(deps: {
  db: Database;
  getSession: (headers: Headers) => Promise<{ user: { id: string } } | null>;
}) {
  const { db } = deps;

  return {
    async getMonthlyUsage(
      ownerId: string,
      input: UsagePeriodInput = {},
    ): Promise<UsageSummary> {
      const parsed = usagePeriodSchema.parse(input);
      const period = parsed.period ?? currentPeriod();
      const { start, end } = monthRange(period);

      const domainIds = db
        .select({ id: domains.id })
        .from(domains)
        .where(eq(domains.ownerId, ownerId));

      const [conversationRow] = await db
        .select({ total: count() })
        .from(conversations)
        .innerJoin(agents, eq(conversations.agentId, agents.id))
        .where(
          and(
            inArray(agents.domainId, domainIds),
            gte(conversations.createdAt, start),
            lt(conversations.createdAt, end),
          ),
        );

      const [messageRow] = await db
        .select({ total: count() })
        .from(messages)
        .innerJoin(conversations, eq(messages.conversationId, conversations.id))
        .innerJoin(agents, eq(conversations.agentId, agents.id))
        .where(
          and(
            inArray(agents.domainId, domainIds),
            gte(messages.createdAt, start),
            lt(messages.createdAt, end),
          ),
        );

      const [emailRow] = await db
        .select({
          total: sql<number>`coalesce(sum(${campaigns.sentCount} + ${campaigns.failedCount}), 0)::int`,
        })
        .from(campaigns)
        .where(
          and(
            eq(campaigns.ownerId, ownerId),
            eq(campaigns.status, "sent"),
            gte(campaigns.createdAt, start),
            lt(campaigns.createdAt, end),
          ),
        );

      const plan = await resolveOwnerPlan(db, ownerId);

      return {
        period,
        plan,
        conversations: conversationRow?.total ?? 0,
        messages: messageRow?.total ?? 0,
        emails: emailRow?.total ?? 0,
        limits: getPlanLimits(plan),
      };
    },

    /** Owner-guarded wrapper for API routes. */
    async getUsageForSession(
      headers: Headers,
      input: UsagePeriodInput = {},
    ): Promise<UsageSummary> {
      const session = await deps.getSession(headers);
      if (!session?.user) {
        throw unauthorized();
      }
      return this.getMonthlyUsage(session.user.id, input);
    },
  };
}

/** Active subscription wins; otherwise the first domain's plan. */
async function resolveOwnerPlan(db: Database, ownerId: string): Promise<Plan> {
  const [sub] = await db
    .select({ plan: subscriptions.plan })
    .from(subscriptions)
    .where(and(eq(subscriptions.ownerId, ownerId), eq(subscriptions.status, "active")))
    .limit(1);
  if (sub) {
    return sub.plan;
  }
  const [row] = await db
    .select({ plan: domains.plan })
    .from(domains)
    .where(eq(domains.ownerId, ownerId))
    .limit(1);
  return row?.plan ?? "free";
}

export type UsageService = ReturnType<typeof createUsageService>;
