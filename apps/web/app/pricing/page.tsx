import type { Metadata } from "next";

import { PLAN_DISPLAY_NAMES, type Plan } from "@repo/api/plans";
import { paystackCurrency, planPriceKobo } from "@repo/api/paystack";
import { PricingModule, type PricingPlan } from "@repo/ui/components/pricing-module";

import { planFeatures } from "@/lib/plan-features";
import { APP_ROUTES } from "@/constants/routes";
import { LandingHeader } from "@/components/landing/landing-header";

export const metadata: Metadata = {
  title: "Pricing",
};

/**
 * The four paid tiers, in the order they appear. Business is recommended.
 *
 * The cards carry no icon: the plan name and its price are enough, and an
 * icon only competes with the name. Pass an `icon` to a plan to bring one
 * back.
 */
const PAID_PLANS: Array<{
  plan: Plan;
  description: string;
  recommended?: boolean;
  summary: string;
}> = [
  {
    plan: "standard",
    description: "For growing teams",
    summary: "Everything in Free, plus:",
  },
  {
    plan: "pro",
    description: "For busy support desks",
    recommended: true,
    summary: "Everything in Plus, plus:",
  },
  {
    plan: "ultimate",
    description: "For high-volume operations",
    summary: "Everything in Business, plus:",
  },
  {
    plan: "custom",
    description: "Tailored limits, hand-agreed",
    summary:
      "Everything in Enterprise, plus unlimited emails and dedicated development support.",
  },
];

/** Price in whole currency units. Custom is negotiated, so it has no price. */
function priceFor(plan: Plan): number {
  if (plan === "custom" || plan === "free") return 0;
  // change to ghana pesswess not kobo
  return planPriceKobo(plan) / 100;
}

/**
 * The currency's prefix, taken from the same formatter the dashboard uses so
 * both pages print a price the same way. Some currencies have no symbol
 * ("GHS 119"), so the code is used instead of inventing one.
 */
function currencyPrefix(): string {
  const currency = paystackCurrency();
  const locale =
    currency === "NGN" ? "en-NG" : currency === "GHS" ? "en-GH" : "en";
  const zero = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(0);
  return zero.replace(/[\d.,\s]/g, "");
}

function toPricingPlan(entry: {
  plan: Plan;
  description: string;
  recommended?: boolean;
  summary: string;
}): PricingPlan {
  const { plan, description, recommended, summary } = entry;
  const isCustom = plan === "custom";

  return {
    id: plan,
    name: PLAN_DISPLAY_NAMES[plan],
    description,
    priceMonthly: priceFor(plan),
    priceLabel: isCustom ? "Custom" : undefined,
    priceNote: isCustom ? "priced to your volume" : undefined,
    currencySymbol: currencyPrefix(),
    summary,
    features: planFeatures(plan),
    recommended,
    actionLabel: isCustom
      ? "Talk to sales"
      : `Start with ${PLAN_DISPLAY_NAMES[plan]}`,
    actionHref: isCustom ? "mailto:sales@ziyarn.com" : APP_ROUTES.SIGN_UP,
  };
}

export default function PricingPage() {
  const paidPlans = PAID_PLANS.map(toPricingPlan);

  const freePlan: PricingPlan = {
    id: "free",
    name: PLAN_DISPLAY_NAMES.free,
    description: "Try the agent on one domain",
    priceMonthly: 0,
    currencySymbol: currencyPrefix(),
    priceNote: "free forever",
    summary: "Everything you need to get one agent live:",
    features: planFeatures("free"),
    wide: true,
    actionLabel: "Start free",
    actionHref: APP_ROUTES.SIGN_UP,
  };

  return (
    <div className="flex min-h-svh flex-col">
      <LandingHeader />
      <main className="flex-1 pb-20">
        <PricingModule
          className="pt-16 pb-6"
          title="Simple pricing that scales with you"
          subtitle="Every plan includes the embeddable widget, an AI agent that answers and sells, knowledge base answers and realtime human handoff. Change or cancel anytime."
          plans={[...paidPlans, freePlan]}
        />
        <p className="mx-auto mt-10 max-w-6xl px-4 text-center text-xs text-muted-foreground md:px-6">
          Prices are per account, billed monthly in {paystackCurrency()}. Custom
          plans are negotiated — every limit above is the default, not a ceiling
          on what you can agree.
        </p>
      </main>
    </div>
  );
}
