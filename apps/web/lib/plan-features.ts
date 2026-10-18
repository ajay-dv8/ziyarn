import { PLAN_LIMITS, type Plan, type PlanLimits } from "@repo/api/plans";
import { WIDGET_VARIANTS } from "@repo/api/domains/widget-variants";
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
    label: (limits) => {
      const names = limits.widgetVariants.map((variantId) => {
        const variant = WIDGET_VARIANTS.find((entry) => entry.id === variantId);
        return variant?.label ?? variantId;
      });
      return names.length === 1
        ? `${names[0]} widget`
        : `All widgets (${names.join(", ")})`;
    },
    included: (limits) => limits.widgetVariants.length > 0,
  },
];

/**
 * The rows for one plan. When a row is excluded the label is the bare feature
 * name — "Marketing emails" struck through — instead of "0 emails / month",
 * which reads like a bug rather than an absence.
 */
export function planFeatures(plan: Plan): PlanFeature[] {
  const limits = PLAN_LIMITS[plan];

  return FEATURE_ROWS.map((row) => ({
    label: row.label(limits),
    included: row.included(limits),
  }));
}
