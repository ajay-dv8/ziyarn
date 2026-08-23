import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";

import { ImportCustomersDialog } from "@/components/dashboard/import-customers-dialog";
import { BackfillCustomersButton } from "@/components/dashboard/backfill-customers-button";
import { authService } from "@/services/auth-service";
import { domainsService } from "@/services/domains-service";
import { customersService } from "@/services/customers-service";
import type { CustomerSource } from "@repo/api/customers/schemas";

export const metadata: Metadata = {
  title: "Customers",
};

const SOURCE_TABS: Array<{
  value: CustomerSource | "all";
  label: string;
}> = [
  { value: "all", label: "All customers" },
  { value: "chat", label: "From chat" },
  { value: "database", label: "From database" },
  { value: "site", label: "Subscribers" },
];

function sourceBadge(source: string, label: string | null) {
  switch (source) {
    case "chat":
      return <Badge className="bg-violet-600/10 text-violet-700 dark:text-violet-300" variant="secondary">Chat agent</Badge>;
    case "database":
      return (
        <Badge
          className="max-w-56 truncate bg-blue-600/10 text-blue-700 dark:text-blue-300"
          variant="secondary"
          title={label ?? undefined}
        >
          Database{label ? ` · ${label}` : ""}
        </Badge>
      );
    default:
      return <Badge variant="secondary">Subscriber</Badge>;
  }
}

export default async function CustomersPage({
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
    source && ["all", "chat", "database", "site"].includes(source)
      ? (source as CustomerSource | "all")
      : "all";
  const trimmedQuery = q?.trim() || undefined;

  const data = selectedDomain
    ? await customersService.list(
        {
          domainId: selectedDomain.id,
          source:
            activeSource === "all" ? undefined : (activeSource as CustomerSource),
          q: trimmedQuery,
        },
        requestHeaders,
      )
    : { customers: [], counts: { all: 0, chat: 0, database: 0, site: 0 } };

  function tabHref(value: CustomerSource | "all") {
    if (!selectedDomain) return "/dashboard/customers";
    const params = new URLSearchParams({ domainId: selectedDomain.id });
    if (value !== "all") params.set("source", value);
    if (trimmedQuery) params.set("q", trimmedQuery);
    return `/dashboard/customers?${params.toString()}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
          <p className="text-sm text-muted-foreground">
            Everyone your business has a relationship with — captured by your
            chat agent, synced from your database, or imported by you.
          </p>
        </div>
        {selectedDomain ? (
          <ImportCustomersDialog domainId={selectedDomain.id} />
        ) : null}
      </div>

      {domains.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {domains.map((domain) => (
            <Link
              key={domain.id}
              href={`/dashboard/customers?domainId=${domain.id}`}
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
          Create a domain first — customers are collected per website.
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
              action="/dashboard/customers"
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
                placeholder="Search name or email…"
                className="h-9 w-52 rounded-lg border border-input bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
              <Button type="submit" size="sm" variant="outline">
                Search
              </Button>
            </form>
          </div>

          {/* table */}
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="hidden sm:table-cell">Added</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.customers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-28 text-center">
                      {trimmedQuery ? (
                        <span className="text-muted-foreground">
                          No customers match “{trimmedQuery}”.
                        </span>
                      ) : activeSource === "site" ? (
                        <span className="text-muted-foreground">
                          No subscribers yet — import a list to add them.
                        </span>
                      ) : activeSource === "chat" ? (
                        <span className="flex flex-col items-center gap-2">
                          <span className="text-muted-foreground">
                            No chat customers yet.
                          </span>
                          <BackfillCustomersButton domainId={selectedDomain.id} />
                        </span>
                      ) : (
                        <span className="text-muted-foreground">
                          No customers yet. They appear here when your chat
                          agent captures an email or you sync a database.
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  data.customers.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell className="font-medium">
                        {customer.name || "—"}
                      </TableCell>
                      <TableCell>{customer.email}</TableCell>
                      <TableCell>
                        {sourceBadge(customer.source, customer.sourceLabel)}
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground sm:table-cell">
                        {new Date(customer.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {data.customers.length >= 500 ? (
            <p className="text-xs text-muted-foreground">
              Showing the latest 500 customers — refine with search or filters.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
