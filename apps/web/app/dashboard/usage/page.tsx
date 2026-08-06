import type { Metadata } from "next";
import { headers } from "next/headers";

import type { UsageSummary } from "@repo/api/usage";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";

import { authService } from "@/services/auth-service";
import { usageService } from "@/services/usage-service";

export const metadata: Metadata = {
  title: "Usage",
};

function MeterCard({
  label,
  used,
  limit,
  hint,
}: {
  label: string;
  used: number;
  limit: number;
  hint: string;
}) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const color =
    pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-lg font-semibold tracking-tight">
            {used.toLocaleString()}
            <span className="text-sm font-normal text-muted-foreground">
              {" "}
              / {limit.toLocaleString()}
            </span>
          </p>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className={`h-full rounded-full ${color}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function periodLabel(period: string): string {
  const [year, month] = period.split("-").map(Number);
  if (!year || !month) {
    return period;
  }
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}

export default async function UsagePage() {
  const requestHeaders = await headers();
  const session = await authService.getSession(requestHeaders);
  if (!session) {
    return null;
  }

  let data: UsageSummary | null = null;
  try {
    data = await usageService.getMonthlyUsage(session.user.id);
  } catch (error) {
    console.error("GET usage failed:", error);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Usage</h1>
        <p className="text-sm text-muted-foreground">
          {data
            ? `What you've used this month (${periodLabel(data.period)}).`
            : "Usage for the current month."}
        </p>
      </div>

      {!data ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <p className="text-sm font-medium">Usage unavailable</p>
            <p className="text-sm text-muted-foreground">
              Try again in a moment.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <MeterCard
              label="Widget conversations"
              used={data.conversations}
              limit={data.limits.conversationsPerDay * 30}
              hint="New conversations across your domains this month."
            />
            <MeterCard
              label="AI messages"
              used={data.messages}
              limit={data.limits.creditsPerMonth}
              hint="Stored messages (visitor + assistant) this month."
            />
            <MeterCard
              label="Marketing emails"
              used={data.emails}
              limit={data.limits.emailsPerMonth}
              hint="Emails sent via campaigns this month."
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Current plan</CardTitle>
              <CardDescription>
                Limits are measured against your plan&apos;s monthly budget.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center gap-3">
              <span className="rounded-lg bg-primary/10 px-3 py-1.5 text-sm font-medium capitalize text-primary">
                {data.plan}
              </span>
              <span className="text-sm text-muted-foreground">
                {data.limits.maxDomains} domains · {data.limits.conversationsPerDay}{" "}
                conversations/day · {data.limits.creditsPerMonth} credits/month ·{" "}
                {data.limits.emailsPerMonth} emails/month
              </span>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
