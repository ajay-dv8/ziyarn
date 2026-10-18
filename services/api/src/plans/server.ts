import {
  DEFAULT_WIDGET_VARIANT,
  WIDGET_VARIANT_IDS,
  resolveWidgetVariant,
  type WidgetVariantId,
} from "@repo/api/domains/widget-variants";
import { planSchema, type Plan } from "@repo/api/plans/schemas";

export type PlanLimits = {
  /** Max domains a user can own on this plan. */
  maxDomains: number;
  /** Max workspaces a user can create on this plan. */
  maxWorkspaces: number;
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
  /**
   * Widgets this plan may use. A domain on a plan that does not include its
   * widget falls back to the first entry, so a downgrade can never leave a
   * visitor with a widget the account no longer includes.
   */
  widgetVariants: WidgetVariantId[];
};

/**
 * SINGLE SOURCE of truth for plan limits. The UI, services and billing all
 * read from here — never re-declare limits elsewhere.
 */
export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: {
    maxDomains: 1,
    maxWorkspaces: 1,
    creditsPerMonth: 100,
    conversationsPerDay: 100,
    emailsPerMonth: 0,
    maxProductsPerDomain: 0,
    maxMembers: 1,
    // The free plan gets the classic bubble only.
    widgetVariants: ["classic"],
  },
  standard: {
    maxDomains: 3,
    maxWorkspaces: 10,
    creditsPerMonth: 200,
    conversationsPerDay: 1000,
    emailsPerMonth: 500,
    maxProductsPerDomain: 100,
    maxMembers: 3,
    widgetVariants: [...WIDGET_VARIANT_IDS],
  },
  pro: {
    maxDomains: 10,
    maxWorkspaces: Number.POSITIVE_INFINITY,
    creditsPerMonth: 1000,
    conversationsPerDay: 5000,
    emailsPerMonth: 2000,
    maxProductsPerDomain: 500,
    maxMembers: 10,
    widgetVariants: [...WIDGET_VARIANT_IDS],
  },
  ultimate: {
    maxDomains: 100,
    maxWorkspaces: Number.POSITIVE_INFINITY,
    creditsPerMonth: 3000,
    conversationsPerDay: 50000,
    emailsPerMonth: 10000,
    maxProductsPerDomain: 3000,
    maxMembers: Number.POSITIVE_INFINITY,
    widgetVariants: [...WIDGET_VARIANT_IDS],
  },
  custom: {
    maxDomains: Number.POSITIVE_INFINITY,
    maxWorkspaces: Number.POSITIVE_INFINITY,
    creditsPerMonth: Number.POSITIVE_INFINITY,
    conversationsPerDay: Number.POSITIVE_INFINITY,
    emailsPerMonth: Number.POSITIVE_INFINITY,
    maxProductsPerDomain: Number.POSITIVE_INFINITY,
    maxMembers: Number.POSITIVE_INFINITY,
    widgetVariants: [...WIDGET_VARIANT_IDS],
  },
};

/** True when a plan may use the given widget. */
export function planAllowsWidgetVariant(
  plan: Plan,
  variant: string,
): boolean {
  return getPlanLimits(plan).widgetVariants.includes(
    variant as WidgetVariantId,
  );
}

/**
 * The widget a domain actually gets on its plan: the one it asked for when the
 * plan includes it, otherwise the first widget the plan allows. A downgrade
 * therefore lands on Classic instead of leaving a visitor with a widget the
 * account no longer includes.
 */
export function clampWidgetVariantForPlan(
  plan: Plan,
  variant: string,
): WidgetVariantId {
  const allowed = getPlanLimits(plan).widgetVariants;
  const resolved = resolveWidgetVariant(variant);
  if (allowed.includes(resolved)) return resolved;
  return allowed[0] ?? DEFAULT_WIDGET_VARIANT;
}

export function getPlanLimits(plan: Plan): PlanLimits {
  return PLAN_LIMITS[plan];
}

/**
 * Plan ordering, highest first. Needed wherever a single effective plan is
 * derived from several rows (a user's domains, a workspace's members' domains):
 * `MAX(plan)` in SQL orders plan names alphabetically, which puts "custom"
 * below "free" and silently downgrades the account.
 */
const PLAN_RANK: Record<Plan, number> = {
  free: 0,
  standard: 1,
  pro: 2,
  ultimate: 3,
  custom: 4,
};

/** Returns the highest-ranking plan in the list, or "free" when empty. */
export function highestPlan(plans: readonly (string | null | undefined)[]): Plan {
  let best: Plan = "free";
  for (const candidate of plans) {
    if (!candidate) continue;
    const plan = planSchema.safeParse(candidate);
    if (!plan.success) continue;
    if (PLAN_RANK[plan.data] > PLAN_RANK[best]) best = plan.data;
  }
  return best;
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

/** Throws if the user already has as many workspaces as their plan allows. */
export function assertCanCreateWorkspace(
  limits: PlanLimits,
  currentWorkspaceCount: number,
): void {
  if (currentWorkspaceCount >= limits.maxWorkspaces) {
    throw new PlanLimitError(
      429,
      "PLAN_LIMIT_EXCEEDED",
      `Your plan allows at most ${limits.maxWorkspaces} workspace(s)`,
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
