import { and, count, eq, gte, inArray, lt, sql } from "drizzle-orm";

import type { Database } from "@repo/database";
import {
  agents,
  campaigns,
  conversations,
  domains,
  messages,
} from "@repo/database/schema";

import { getPlanLimits } from "@repo/api/plans";
import { resolveActiveWorkspaceId } from "@repo/api/workspaces/active";
import { resolveWorkspacePlan } from "@repo/api/workspaces/plan";
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
 * Workspace-scoped usage metering: conversations, AI messages and marketing
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
      workspaceId: string | null,
      input: UsagePeriodInput = {},
    ): Promise<UsageSummary> {
      const parsed = usagePeriodSchema.parse(input);
      const period = parsed.period ?? currentPeriod();
      const { start, end } = monthRange(period);

      // A user without a workspace has no usage yet, but the page still needs
      // a plan and limits to render.
      if (!workspaceId) {
        return {
          period,
          plan: "free",
          conversations: 0,
          messages: 0,
          emails: 0,
          limits: getPlanLimits("free"),
        };
      }

      const domainIds = db
        .select({ id: domains.id })
        .from(domains)
        .where(eq(domains.workspaceId, workspaceId));

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
            eq(campaigns.workspaceId, workspaceId),
            eq(campaigns.status, "sent"),
            gte(campaigns.createdAt, start),
            lt(campaigns.createdAt, end),
          ),
        );

      const plan = await resolveWorkspacePlan(db, workspaceId);

      return {
        period,
        plan,
        conversations: conversationRow?.total ?? 0,
        messages: messageRow?.total ?? 0,
        emails: emailRow?.total ?? 0,
        limits: getPlanLimits(plan),
      };
    },

    /** Session- and workspace-guarded wrapper for API routes. */
    async getUsageForSession(
      headers: Headers,
      input: UsagePeriodInput = {},
    ): Promise<UsageSummary> {
      const session = await deps.getSession(headers);
      if (!session?.user) {
        throw unauthorized();
      }
      const workspaceId = await resolveActiveWorkspaceId(
        db,
        headers,
        session.user.id,
      );
      return this.getMonthlyUsage(workspaceId, input);
    },
  };
}

export type UsageService = ReturnType<typeof createUsageService>;
