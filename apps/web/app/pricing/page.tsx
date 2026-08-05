import type { Metadata } from "next";

import { PLAN_LIMITS } from "@repo/api/plans";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";

import { LandingHeader } from "@/components/landing/landing-header";

export const metadata: Metadata = {
  title: "Pricing",
};

const PLANS = [
  {
    plan: "free",
    tagline: "Try the agent on one domain",
    highlight: false,
  },
  {
    plan: "standard",
    tagline: "For growing teams",
    highlight: true,
  },
  {
    plan: "pro",
    tagline: "For busy support desks",
    highlight: false,
  },
  {
    plan: "ultimate",
    tagline: "For high-volume operations",
    highlight: false,
  },
] as const;

export default function PricingPage() {
  return (
    <div className="flex min-h-svh flex-col">
      <LandingHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-16">
        <div className="space-y-3 text-center">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Simple pricing that scales with you
          </h1>
          <p className="mx-auto max-w-xl text-muted-foreground">
            Every plan includes the widget, AI agent, and realtime human
            handoff. Billing launches soon.
          </p>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS.map(({ plan, tagline, highlight }) => {
            const limits = PLAN_LIMITS[plan];
            return (
              <Card
                key={plan}
                className={
                  highlight ? "border-primary shadow-lg" : undefined
                }
              >
                <CardHeader>
                  <CardTitle className="capitalize">{plan}</CardTitle>
                  <CardDescription>{tagline}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold tracking-tight">$0</p>
                  <p className="text-xs text-muted-foreground">
                    Pricing coming soon
                  </p>
                  <ul className="mt-4 space-y-2 text-sm">
                    <li>{limits.maxDomains} domain(s)</li>
                    <li>{limits.creditsPerMonth.toLocaleString()} AI credits / month</li>
                    <li>{limits.conversationsPerDay.toLocaleString()} conversations / day</li>
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
}
