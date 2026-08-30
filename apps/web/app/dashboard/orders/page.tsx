import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";

import { Button } from "@repo/ui/components/button";

import { OrdersTable } from "@/components/dashboard/orders-table";
import { authService } from "@/services/auth-service";
import { domainsService } from "@/services/domains-service";
import { ordersService } from "@/services/orders-service";

export const metadata: Metadata = {
  title: "Orders",
};

const SOURCE_TABS: Array<{
  value: "all" | "chat" | "db";
  label: string;
}> = [
  { value: "all", label: "All orders" },
  { value: "chat", label: "From chat" },
  { value: "db", label: "From DB" },
];

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ domainId?: string; source?: string; q?: string }>;
}) {
  const requestHeaders = await headers();
  const session = await authService.getSession(requestHeaders);
  if (!session) {
    return null;
  }

  const domains = await domainsService.listDomains(requestHeaders);
  const { domainId, source, q } = await searchParams;
  const selectedDomain =
    domains.find((domain) => domain.id === domainId) ?? domains[0];

  const activeSource =
    source && ["all", "chat", "db"].includes(source)
      ? (source as "all" | "chat" | "db")
      : "all";
  const trimmedQuery = q?.trim() || undefined;

  const data = selectedDomain
    ? await ordersService.list(
        {
          domainId: selectedDomain.id,
          source: activeSource === "all" ? undefined : activeSource,
          q: trimmedQuery,
        },
        requestHeaders,
      )
    : { orders: [], counts: { all: 0, chat: 0, db: 0 } };

  function tabHref(value: "all" | "chat" | "db") {
    if (!selectedDomain) return "/dashboard/orders";
    const params = new URLSearchParams({ domainId: selectedDomain.id });
    if (value !== "all") params.set("source", value);
    if (trimmedQuery) params.set("q", trimmedQuery);
    return `/dashboard/orders?${params.toString()}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>
          <p className="text-sm text-muted-foreground">
            Track orders placed through your chat widget and synced from your
            connected database.
          </p>
        </div>
      </div>

      {domains.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {domains.map((domain) => (
            <Link
              key={domain.id}
              href={`/dashboard/orders?domainId=${domain.id}`}
              className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                selectedDomain?.id === domain.id
                  ? "border-primary bg-primary/10 font-medium text-primary"
                  : "border-input text-muted-foreground hover:text-foreground"
              }`}
            >
              {domain.name}
            </Link>
          ))}
        </div>
      ) : null}

      {!selectedDomain ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Create a domain first — orders are tracked per website.
        </p>
      ) : (
        <>
          {/* tabs */}
          <div className="flex flex-wrap items-center gap-2">
            {SOURCE_TABS.map((tab) => (
              <Link
                key={tab.value}
                href={tabHref(tab.value)}
                className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                  activeSource === tab.value
                    ? "border-primary bg-primary/10 font-medium text-primary"
                    : "border-input text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
                <span className="ml-1.5 text-xs opacity-70">
                  {data.counts[tab.value]}
                </span>
              </Link>
            ))}
            <form
              action="/dashboard/orders"
              method="get"
              className="ml-auto flex items-center gap-2"
            >
              {selectedDomain ? (
                <input type="hidden" name="domainId" value={selectedDomain.id} />
              ) : null}
              {activeSource !== "all" ? (
                <input type="hidden" name="source" value={activeSource} />
              ) : null}
              <input
                type="search"
                name="q"
                defaultValue={trimmedQuery ?? ""}
                placeholder="Search email…"
                className="h-9 w-52 rounded-lg border border-input bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
              <Button type="submit" size="sm" variant="outline">
                Search
              </Button>
            </form>
          </div>

          {/* table */}
          {data.orders.length === 0 ? (
            <div className="rounded-lg border">
              <div className="flex h-28 flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground">
                <span>
                  {trimmedQuery ? (
                    <>No orders match &ldquo;{trimmedQuery}&rdquo;.</>
                  ) : activeSource === "chat" ? (
                    <>No widget orders yet — they appear when visitors purchase through the chat.</>
                  ) : activeSource === "db" ? (
                    <>No database orders yet — mark a table as orders in your database integration.</>
                  ) : (
                    <>
                      No orders yet. They appear when your chat agent sells a
                      product or creates a payment request.
                    </>
                  )}
                </span>
              </div>
            </div>
          ) : (
            <OrdersTable
              orders={data.orders.map((order) => ({
                id: order.id,
                email: order.email,
                description: order.description,
                amountMinor: order.amountMinor,
                currency: order.currency,
                status: order.status,
                source: order.source,
                sourceLabel: order.sourceLabel,
                createdAt:
                  order.createdAt instanceof Date
                    ? order.createdAt.toISOString()
                    : String(order.createdAt),
              }))}
            />
          )}
        </>
      )}
    </div>
  );
}
