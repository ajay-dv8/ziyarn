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
  /** Max team members (owners + agents) on this plan. */
  maxMembers: number;
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
    maxMembers: 1,
  },
  standard: {
    maxDomains: 3,
    creditsPerMonth: 1000,
    conversationsPerDay: 1000,
    emailsPerMonth: 500,
    maxProductsPerDomain: 100,
    maxMembers: 3,
  },
  pro: {
    maxDomains: 10,
    creditsPerMonth: 10000,
    conversationsPerDay: 5000,
    emailsPerMonth: 5000,
    maxProductsPerDomain: 500,
    maxMembers: 10,
  },
  ultimate: {
    maxDomains: 100,
    creditsPerMonth: 100000,
    conversationsPerDay: 50000,
    emailsPerMonth: 50000,
    maxProductsPerDomain: 10000,
    maxMembers: Number.POSITIVE_INFINITY,
  },
  custom: {
    maxDomains: Number.POSITIVE_INFINITY,
    creditsPerMonth: Number.POSITIVE_INFINITY,
    conversationsPerDay: Number.POSITIVE_INFINITY,
    emailsPerMonth: Number.POSITIVE_INFINITY,
    maxProductsPerDomain: Number.POSITIVE_INFINITY,
    maxMembers: Number.POSITIVE_INFINITY,
  },
};

export function getPlanLimits(plan: Plan): PlanLimits {
  return PLAN_LIMITS[plan];
}

/** Display names for plans — use instead of capitalizing the internal ID. */
export const PLAN_DISPLAY_NAMES: Record<Plan, string> = {
  free: "Free",
  standard: "Plus",
  pro: "Business",
  ultimate: "Enterprise",
  custom: "Custom",
};

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
      "Catalog products require the Plus plan or above",
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
