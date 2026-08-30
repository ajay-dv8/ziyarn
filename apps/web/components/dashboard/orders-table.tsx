"use client";

import { Badge } from "@repo/ui/components/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";

export type OrderTableRow = {
  id: string;
  email: string | null;
  description: string | null;
  amountMinor: number;
  currency: string;
  status: string;
  source: "chat" | "db";
  sourceLabel: string | null;
  createdAt: string;
};

function formatMoney(amountMinor: number, currency: string): string {
  const divisor = currency === "ghs" ? 100 : 100;
  const amount = amountMinor / divisor;
  const symbols: Record<string, string> = {
    ghs: "GH₵",
    usd: "$",
    eur: "€",
    gbp: "£",
  };
  return `${symbols[currency] ?? currency} ${amount.toFixed(2)}`;
}

function statusBadge(status: string) {
  switch (status) {
    case "paid":
      return (
        <Badge className="bg-emerald-600/10 text-emerald-700 dark:text-emerald-300">
          Paid
        </Badge>
      );
    case "pending":
      return (
        <Badge className="bg-amber-600/10 text-amber-700 dark:text-amber-300">
          Pending
        </Badge>
      );
    case "requires_payment":
      return (
        <Badge className="bg-blue-600/10 text-blue-700 dark:text-blue-300">
          Awaiting payment
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="destructive">
          Failed
        </Badge>
      );
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

function sourceBadge(source: string, label: string | null) {
  switch (source) {
    case "chat":
      return (
        <Badge
          className="bg-violet-600/10 text-violet-700 dark:text-violet-300"
          variant="secondary"
        >
          From chat
        </Badge>
      );
    case "db":
      return (
        <Badge
          className="max-w-56 truncate bg-blue-600/10 text-blue-700 dark:text-blue-300"
          variant="secondary"
          title={label ?? undefined}
        >
          From DB{label ? ` · ${label}` : ""}
        </Badge>
      );
    default:
      return <Badge variant="secondary">{source}</Badge>;
  }
}

export function OrdersTable({
  orders,
}: {
  orders: OrderTableRow[];
}) {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Order</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Source</TableHead>
            <TableHead className="hidden sm:table-cell">Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                No orders match.
              </TableCell>
            </TableRow>
          ) : (
            orders.map((order) => (
              <TableRow key={order.id}>
                <TableCell className="font-medium">
                  <span className="max-w-48 truncate text-sm" title={order.description ?? order.id}>
                    {order.description ?? order.id.slice(0, 8)}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-sm">{order.email ?? "—"}</span>
                </TableCell>
                <TableCell>
                  <span className="text-sm font-medium">
                    {formatMoney(order.amountMinor, order.currency)}
                  </span>
                </TableCell>
                <TableCell>{statusBadge(order.status)}</TableCell>
                <TableCell>{sourceBadge(order.source, order.sourceLabel)}</TableCell>
                <TableCell className="hidden text-muted-foreground sm:table-cell">
                  {new Date(order.createdAt).toLocaleDateString("en-US", {
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
  );
}
