import type { Plan } from "@repo/api/plans/schemas";

export type PlanLimits = {
  /** Max domains a user can own on this plan. */
  maxDomains: number;
  /** Max AI credits per domain per month (P3/P6 will consume these). */
  creditsPerMonth: number;
  /** Max widget conversations per domain per day. */
  conversationsPerDay: number;
};

/**
 * SINGLE SOURCE of truth for plan limits. The UI, services and billing all
 * read from here — never re-declare limits elsewhere.
 */
export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: { maxDomains: 1, creditsPerMonth: 100, conversationsPerDay: 100 },
  standard: { maxDomains: 5, creditsPerMonth: 1000, conversationsPerDay: 1000 },
  pro: { maxDomains: 20, creditsPerMonth: 10000, conversationsPerDay: 5000 },
  ultimate: {
    maxDomains: 100,
    creditsPerMonth: 100000,
    conversationsPerDay: 50000,
  },
};

export function getPlanLimits(plan: Plan): PlanLimits {
  return PLAN_LIMITS[plan];
}

export class PlanLimitError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "PlanLimitError";
  }
}

/** Throws if the user already owns as many domains as their plan allows. */
export function assertCanCreateDomain(
  limits: PlanLimits,
  currentDomainCount: number,
): void {
  if (currentDomainCount >= limits.maxDomains) {
    throw new PlanLimitError(
      429,
      "PLAN_LIMIT_EXCEEDED",
      `Your plan allows at most ${limits.maxDomains} domain(s)`,
    );
  }
}
