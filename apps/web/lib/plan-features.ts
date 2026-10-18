import { PLAN_LIMITS, type Plan, type PlanLimits } from "@repo/api/plans";
import type { PlanFeature } from "@repo/ui/components/pricing-module";

/**
 * The feature rows a pricing card shows, and the label each plan gets for them.
 *
 * Every plan renders the *same* rows in the same order, with its own numbers,
 * so two cards can be read against each other: a row crossed out on Free is
 * visibly present on the plan above it. Labels come from PLAN_LIMITS rather
 * than being written per plan, so the advertised numbers and the enforced ones
 * cannot drift.
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

/** A limit that is off is shown as excluded, not as "0". */
function hasLimit(value: number): boolean {
  return value > 0;
}

type FeatureRow = {
  label: (limits: PlanLimits) => string;
  included: (limits: PlanLimits) => boolean;
};

const FEATURE_ROWS: readonly FeatureRow[] = [
  {
    label: (limits) => plural(limits.maxDomains, "domain"),
    included: (limits) => hasLimit(limits.maxDomains),
  },
  {
    label: (limits) => plural(limits.maxWorkspaces, "team workspace"),
    included: (limits) => hasLimit(limits.maxWorkspaces),
  },
  {
    label: (limits) => plural(limits.maxMembers, "team member"),
    included: (limits) => hasLimit(limits.maxMembers),
  },
  {
    label: (limits) =>
      hasLimit(limits.creditsPerMonth)
        ? `${formatLimit(limits.creditsPerMonth)} AI credits / month`
        : "AI credits",
    included: (limits) => hasLimit(limits.creditsPerMonth),
  },
  {
    label: (limits) =>
      hasLimit(limits.conversationsPerDay)
        ? `${formatLimit(limits.conversationsPerDay)} conversations / day`
        : "Conversations",
    included: (limits) => hasLimit(limits.conversationsPerDay),
  },
  {
    label: (limits) =>
      hasLimit(limits.emailsPerMonth)
        ? `${formatLimit(limits.emailsPerMonth)} emails / month`
        : "Marketing emails",
    included: (limits) => hasLimit(limits.emailsPerMonth),
  },
  {
    label: (limits) =>
      hasLimit(limits.maxProductsPerDomain)
        ? `${plural(limits.maxProductsPerDomain, "product")} per domain`
        : "Catalog products",
    included: (limits) => hasLimit(limits.maxProductsPerDomain),
  },
  {
    // One label for every plan: the widget row says whether the plan lets the
    // owner pick a widget, not which widgets exist.
    label: () => "Choose your widget",
    included: (limits) => limits.widgetVariants.length > 1,
  },
];

/**
 * Plans whose card is not a list of limits. Custom is negotiated, so its card
 * states what it adds to the tier below rather than repeating "unlimited" on
 * every row.
 */
const PLAN_FEATURE_OVERRIDES: Partial<Record<Plan, PlanFeature[]>> = {
  custom: [
    { label: "Everything in Enterprise", included: true },
    { label: "Unlimited emails / month", included: true },
    { label: "Dedicated development support", included: true },
  ],
};

/**
 * The rows for one plan. When a row is excluded the label is the bare feature
 * name — "Marketing emails" struck through — instead of "0 emails / month",
 * which reads like a bug rather than an absence.
 */
export function planFeatures(plan: Plan): PlanFeature[] {
  const override = PLAN_FEATURE_OVERRIDES[plan];
  if (override) return override;

  const limits = PLAN_LIMITS[plan];

  return FEATURE_ROWS.map((row) => ({
    label: row.label(limits),
    included: row.included(limits),
  }));
}
