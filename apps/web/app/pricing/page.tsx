import type { Metadata } from "next";

import { PLAN_DISPLAY_NAMES } from "@repo/api/plans";
import type { Plan } from "@repo/api/plans";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { Check } from "lucide-react";

import { PLAN_ORDER, planFeatures } from "@/lib/plan-features";
import { LandingHeader } from "@/components/landing/landing-header";

export const metadata: Metadata = {
  title: "Pricing",
};

/** Tagline and emphasis per plan. Order comes from PLAN_ORDER. */
const PLAN_DETAILS: Record<Plan, { tagline: string; highlight: boolean }> = {
  free: { tagline: "Try the agent on one domain", highlight: false },
  standard: { tagline: "For growing teams", highlight: true },
  pro: { tagline: "For busy support desks", highlight: false },
  ultimate: { tagline: "For high-volume operations", highlight: false },
  custom: { tagline: "Tailored limits, hand-agreed", highlight: false },
};

export default function PricingPage() {
  return (
    <div className="flex min-h-svh flex-col">
      <LandingHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-16">
        <div className="space-y-3 text-center">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Simple pricing that scales with you
          </h1>
          <p className="mx-auto max-w-xl text-muted-foreground">
            Every plan includes the widget, AI agent, and realtime human
            handoff. Billing launches soon.
          </p>
        </div>

        <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          {[
            "Embeddable chat widget",
            "AI agent with tools",
            "Knowledge base answers",
            "Realtime human handoff",
          ].map((capability) => (
            <li key={capability} className="flex items-center gap-1.5">
              <Check className="size-4 text-primary" aria-hidden="true" />
              {capability}
            </li>
          ))}
        </ul>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {PLAN_ORDER.map((plan) => {
            const { tagline, highlight } = PLAN_DETAILS[plan];
            const features = planFeatures(plan);
            const isCustom = plan === "custom";

            return (
              <Card
                key={plan}
                className={
                  highlight ? "flex flex-col border-primary shadow-lg" : "flex flex-col"
                }
              >
                <CardHeader>
                  <CardTitle>{PLAN_DISPLAY_NAMES[plan]}</CardTitle>
                  {/* Reserved two lines so every card's price and "What you
                      get" heading start at the same height. */}
                  <CardDescription className="min-h-10">{tagline}</CardDescription>
                  <p className="mt-2 text-2xl font-semibold tracking-tight">
                    {isCustom ? "Custom" : "$0"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isCustom ? "Priced to your volume" : "Pricing coming soon"}
                  </p>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    What you get
                  </p>
                  <ul className="mt-3 flex-1 space-y-2 text-sm">
                    {features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <Check
                          className="mt-0.5 size-4 shrink-0 text-primary"
                          aria-hidden="true"
                        />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Limits are per account and shown for every plan that has them — Custom
          is negotiated, so talk to us.
        </p>
      </main>
    </div>
  );
}
