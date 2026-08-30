import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";

import { formatMoney } from "@repo/money";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";

import { SeriesBars, StatusBars } from "@/components/dashboard/analytics-charts";
import { authService } from "@/services/auth-service";
import { domainsService } from "@/services/domains-service";
import { analyticsService } from "@/services/analytics-service";

export const metadata: Metadata = {
  title: "Analytics",
};

const RANGES = ["7", "30", "90"] as const;
const RANGE_LABELS: Record<(typeof RANGES)[number], string> = {
  "7": "7 days",
  "30": "30 days",
  "90": "90 days",
};

function KpiCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
        {sub ? <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p> : null}
      </CardContent>
    </Card>
  );
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ domainId?: string; range?: string }>;
}) {
  const requestHeaders = await headers();
  const session = await authService.getSession(requestHeaders);
  if (!session) {
    return null;
  }

  const domains = await domainsService.listDomains(requestHeaders);
  const { domainId, range: rangeParam } = await searchParams;
  const range = (RANGES as readonly string[]).includes(rangeParam ?? "")
    ? (rangeParam as (typeof RANGES)[number])
    : "30";

  const selected = domains.find((domain) => domain.id === domainId) ?? domains[0];
  const data = selected
    ? await analyticsService.getAnalytics(
        { domainId: selected.id, range },
        requestHeaders,
      )
    : null;

  const revenueTotal =
    data?.totals.revenueByCurrency
      .map((entry) => formatMoney({ amountMinor: entry.minor, currency: entry.currency }))
      .join(" + ") ?? "GH₵0.00";
  const revenueSub =
    data?.totals.revenueByCurrency.length === 1
      ? `${data.totals.paidPayments} paid`
      : undefined;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Conversations, leads, bookings and revenue over time.
          </p>
        </div>
        {selected ? (
          <div className="flex gap-1 rounded-lg border p-1">
            {RANGES.map((value) => (
              <Link
                key={value}
                href={`/dashboard/analytics?domainId=${selected.id}&range=${value}`}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                  range === value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {RANGE_LABELS[value]}
              </Link>
            ))}
          </div>
        ) : null}
      </div>

      {domains.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {domains.map((domain) => (
            <Link
              key={domain.id}
              href={`/dashboard/analytics?domainId=${domain.id}&range=${range}`}
              className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                selected?.id === domain.id
                  ? "border-primary bg-primary/10 font-medium text-primary"
                  : "border-input text-muted-foreground hover:text-foreground"
              }`}
            >
              {domain.name}
            </Link>
          ))}
        </div>
      ) : null}

      {!selected ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <p className="text-sm font-medium">No domains yet</p>
            <p className="text-sm text-muted-foreground">
              Create a domain first, then check back here for insights.
            </p>
          </CardContent>
        </Card>
      ) : !data ? null : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <KpiCard label="Conversations" value={String(data.totals.conversations)} />
            <KpiCard label="Leads captured" value={String(data.totals.leads)} />
            <KpiCard
              label="Bookings"
              value={String(data.totals.confirmedBookings)}
              sub={`${data.totals.bookings} total`}
            />
            <KpiCard
              label="Payments"
              value={String(data.totals.paidPayments)}
              sub={`${data.totals.payments} total`}
            />
            <KpiCard label="Revenue" value={revenueTotal} sub={revenueSub} />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Activity</CardTitle>
                <CardDescription>
                  Daily conversations, leads and payments (last {RANGE_LABELS[range].replace(" days", "")} days)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SeriesBars series={data.series} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Conversations by status</CardTitle>
              </CardHeader>
              <CardContent>
                <StatusBars rows={data.conversationsByStatus} color="bg-primary" />
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Bookings by status</CardTitle>
              </CardHeader>
              <CardContent>
                <StatusBars rows={data.bookingsByStatus} color="bg-amber-500" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Payments by status</CardTitle>
              </CardHeader>
              <CardContent>
                <StatusBars rows={data.paymentsByStatus} color="bg-emerald-500" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top products</CardTitle>
                <CardDescription>Paid purchases in this range</CardDescription>
              </CardHeader>
              <CardContent>
                {data.topProducts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No paid purchases yet.</p>
                ) : (
                  <ul className="space-y-3">
                    {data.topProducts.map((product) => (
                      <li key={product.productId}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{product.name}</span>
                          <span className="text-muted-foreground">
                            {product.paidCount} sold
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {product.revenueByCurrency.length === 0
                            ? "—"
                            : product.revenueByCurrency
                                .map((entry) => formatMoney({ amountMinor: entry.minor, currency: entry.currency }))
                                .join(" + ")}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Campaigns</CardTitle>
                <CardDescription>Emails sent across all domains</CardDescription>
              </CardHeader>
              <CardContent>
                {data.campaigns.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No campaigns in this range.</p>
                ) : (
                  <ul className="space-y-3">
                    {data.campaigns.map((campaign) => (
                      <li key={campaign.id} className="text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-medium">{campaign.name}</span>
                          <span className="shrink-0 capitalize text-muted-foreground">
                            {campaign.status}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {campaign.sent} sent · {campaign.delivered} delivered ·{" "}
                          {campaign.failed} failed · {campaign.unsubscribed} unsubscribed
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}