import type { Plan } from "@repo/api/plans/schemas";

export type PlanLimits = {
  /** Max domains a user can own on this plan. */
  maxDomains: number;
  /** Max AI credits per domain per month (P3/P6 will consume these). */
  creditsPerMonth: number;
  /** Max widget conversations per domain per day. */
  conversationsPerDay: number;
  /** Max marketing emails an owner can send per month. */
  emailsPerMonth: number;
  /** Max catalog products an owner can define per domain. */
  maxProductsPerDomain: number;
};

/**
 * SINGLE SOURCE of truth for plan limits. The UI, services and billing all
 * read from here — never re-declare limits elsewhere.
 */
export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: {
    maxDomains: 1,
    creditsPerMonth: 100,
    conversationsPerDay: 100,
    emailsPerMonth: 0,
    maxProductsPerDomain: 0,
  },
  standard: {
    maxDomains: 5,
    creditsPerMonth: 1000,
    conversationsPerDay: 1000,
    emailsPerMonth: 500,
    maxProductsPerDomain: 50,
  },
  pro: {
    maxDomains: 20,
    creditsPerMonth: 10000,
    conversationsPerDay: 5000,
    emailsPerMonth: 5000,
    maxProductsPerDomain: 500,
  },
  ultimate: {
    maxDomains: 100,
    creditsPerMonth: 100000,
    conversationsPerDay: 50000,
    emailsPerMonth: 50000,
    maxProductsPerDomain: 5000,
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

/** Throws if a domain already had its daily widget-conversation budget. */
export function assertCanStartConversation(
  limits: PlanLimits,
  conversationsToday: number,
): void {
  if (conversationsToday >= limits.conversationsPerDay) {
    throw new PlanLimitError(
      429,
      "CONVERSATION_LIMIT_EXCEEDED",
      `Your plan allows ${limits.conversationsPerDay} widget conversations per day`,
    );
  }
}

/** Throws if the domain's product catalog is at capacity for the plan. */
export function assertCanCreateProduct(
  limits: PlanLimits,
  currentProductCount: number,
): void {
  if (limits.maxProductsPerDomain <= 0) {
    throw new PlanLimitError(
      429,
      "PLAN_LIMIT_EXCEEDED",
      "Catalog products require the Standard plan or above",
    );
  }
  if (currentProductCount >= limits.maxProductsPerDomain) {
    throw new PlanLimitError(
      429,
      "PLAN_LIMIT_EXCEEDED",
      `Your plan allows at most ${limits.maxProductsPerDomain} products per domain`,
    );
  }
}
