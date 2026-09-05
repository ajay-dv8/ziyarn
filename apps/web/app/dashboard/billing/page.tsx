import type { Metadata } from "next";
import { headers } from "next/headers";

import { getPlanLimits, PLAN_DISPLAY_NAMES, type Plan } from "@repo/api/plans";
import { formatPlanPrice } from "@repo/api/paystack";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/components/card";

import { CancelSubscriptionButton } from "@/components/dashboard/cancel-subscription-button";
import { ManageSubscriptionButton } from "@/components/dashboard/manage-subscription-button";
import { UpgradeButton } from "@/components/dashboard/upgrade-button";
import { authService } from "@/services/auth-service";
import { billingService } from "@/services/billing-service";
import { domainsService } from "@/services/domains-service";

export const metadata: Metadata = {
  title: "Billing",
};

const PLAN_RANK: Record<Plan, number> = {
  free: 0,
  standard: 1,
  pro: 2,
  ultimate: 3,
  custom: 4,
};

const PLANS: Array<{
  id: "standard" | "pro" | "ultimate";
  name: string;
  blurb: string;
}> = [
  { id: "standard", name: "Plus", blurb: "For growing teams" },
  { id: "pro", name: "Business", blurb: "For serious operators" },
  { id: "ultimate", name: "Enterprise", blurb: "For platforms" },
];

function formatLimit(value: number): string {
  if (!Number.isFinite(value)) return "Unlimited";
  return value.toLocaleString();
}

export default async function BillingPage() {
  const requestHeaders = await headers();
  const session = await authService.getSession(requestHeaders);
  if (!session) {
    return null;
  }
  const domains = await domainsService.listDomains(requestHeaders);
  const plan = domains.reduce<Plan>(
    (best, domain) => (PLAN_RANK[domain.plan] > PLAN_RANK[best] ? domain.plan : best),
    "free",
  );
  const limits = getPlanLimits(plan);
  const subscription = await billingService.getSubscription(session.user.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
        <p className="text-sm text-muted-foreground">
          Upgrade to lift your domain, conversation and email limits.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Current plan</CardTitle>
          <CardDescription>
            {plan === "free"
              ? "You are on the free plan."
              : `You are on the ${PLAN_DISPLAY_NAMES[plan]} plan — all your domains get its limits.`}
            {subscription?.status === "active"
              ? ` Subscription ${subscription.status}${
                  subscription.currentPeriodEnd
                    ? `, renews ${subscription.currentPeriodEnd.toLocaleDateString("en-US")}`
                    : ""
                }.`
              : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <li className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Domains</p>
              <p className="text-lg font-semibold">{formatLimit(limits.maxDomains)} max</p>
            </li>
            <li className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">AI credits / month</p>
              <p className="text-lg font-semibold">{formatLimit(limits.creditsPerMonth)}</p>
            </li>
            <li className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Conversations / day</p>
              <p className="text-lg font-semibold">{formatLimit(limits.conversationsPerDay)}</p>
            </li>
            <li className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Emails / month</p>
              <p className="text-lg font-semibold">{formatLimit(limits.emailsPerMonth)}</p>
            </li>
          </ul>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        {PLANS.map((p) => (
          <Card
            key={p.id}
            className={plan === p.id ? "border-primary" : undefined}
          >
            <CardHeader>
              <CardTitle>{p.name}</CardTitle>
              <CardDescription>{p.blurb}</CardDescription>
              <p className="text-2xl font-semibold tracking-tight">
                {formatPlanPrice(p.id)}
              </p>
            </CardHeader>
            <CardContent>
              <UpgradeButton
                plan={p.id}
                label="Upgrade"
                current={plan === p.id}
                email={session.user.email}
              />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className={plan === "custom" ? "border-primary" : undefined}>
        <CardHeader>
          <CardTitle>Custom</CardTitle>
          <CardDescription>Tailored for your needs</CardDescription>
          <p className="text-2xl font-semibold tracking-tight">Custom pricing</p>
        </CardHeader>
        <CardContent>
          {plan === "custom" ? (
            <Button variant="secondary" disabled className="w-full">
              Current plan
            </Button>
          ) : (
            <Button render={<a href="mailto:sales@ziyarn.com" />} className="w-full">
              Contact Sales
            </Button>
          )}
        </CardContent>
      </Card>

      {subscription?.customerSubscriptionCode && subscription.status !== "canceled" ? (
        <Card>
          <CardHeader>
            <CardTitle>Manage subscription</CardTitle>
            <CardDescription>
              Cancel your Paystack subscription. Your domains revert to the
              free plan immediately.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CancelSubscriptionButton />
          </CardContent>
        </Card>
      ) : subscription?.stripeCustomerId ? (
        <Card>
          <CardHeader>
            <CardTitle>Manage subscription</CardTitle>
            <CardDescription>
              Cancel, switch plans or update your payment method.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ManageSubscriptionButton />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
