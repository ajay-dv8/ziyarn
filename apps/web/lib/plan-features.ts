import { PLAN_LIMITS, type Plan } from "@repo/api/plans";

/**
 * The feature list shown on a plan's card.
 *
 * Built from PLAN_LIMITS rather than written out per plan, so the pricing page
 * cannot advertise a number the billing system will not honour. Copy that is
 * not a number (capability differences between tiers) belongs in the plan's
 * tagline or in `PLAN_EXTRAS` below — anything derivable stays derivable.
 */

/** Formats a limit for people: 1000 -> "1,000", Infinity -> "Unlimited". */
export function formatLimit(value: number): string {
  if (!Number.isFinite(value)) return "Unlimited";
  return value.toLocaleString();
}

/** "1 domain" / "3 domains" / "Unlimited domains". */
function plural(
  value: number,
  singular: string,
  pluralForm = `${singular}s`,
): string {
  if (!Number.isFinite(value)) return `Unlimited ${pluralForm}`;
  return `${value.toLocaleString()} ${value === 1 ? singular : pluralForm}`;
}

/**
 * Per-plan extras that are not limits: capabilities that switch on at a tier.
 * Empty means "nothing beyond the numbers" — which is true for every plan
 * today, since the widget, agent, knowledge base and human handoff ship on all
 * of them. Kept as a list so a future tier has somewhere obvious to go.
 */
const PLAN_EXTRAS: Partial<Record<Plan, readonly string[]>> = {};

/** Everything a given plan includes, most fundamental first. */
export function planFeatures(plan: Plan): string[] {
  const limits = PLAN_LIMITS[plan];

  const features = [
    plural(limits.maxDomains, "domain"),
    plural(limits.maxWorkspaces, "team workspace"),
    `${formatLimit(limits.creditsPerMonth)} AI credits / month`,
    `${formatLimit(limits.conversationsPerDay)} conversations / day`,
    limits.emailsPerMonth === 0
      ? "No marketing emails"
      : `${formatLimit(limits.emailsPerMonth)} emails / month`,
    limits.maxProductsPerDomain === 0
      ? "No catalog products"
      : `${plural(limits.maxProductsPerDomain, "product")} per domain`,
    plural(limits.maxMembers, "team member"),
    ...(PLAN_EXTRAS[plan] ?? []),
  ];

  return features;
}

/** Shown on the free card so the paid tiers read as "free, plus more". */
export const PLAN_ORDER = [
  "free",
  "standard",
  "pro",
  "ultimate",
  "custom",
] as const satisfies readonly Plan[];
