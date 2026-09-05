"use client";

import { useState } from "react";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Checkbox } from "@repo/ui/components/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";
import { Ban, Loader2, Trash2, Undo2 } from "lucide-react";

export type CustomerTableRow = {
  id: string;
  name: string | null;
  email: string;
  source: string;
  sourceLabel: string | null;
  blocked: boolean;
  createdAt: string;
};

function sourceBadge(source: string, label: string | null) {
  switch (source) {
    case "chat":
      return (
        <Badge
          className="bg-violet-600/10 text-violet-700 dark:text-violet-300"
          variant="secondary"
        >
          Chat agent
        </Badge>
      );
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

export function CustomersTable({
  domainId,
  customers,
}: {
  domainId: string;
  customers: CustomerTableRow[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allSelected =
    customers.length > 0 && customers.every((customer) => selected.has(customer.id));

  function toggleAll() {
    setSelected((prev) => {
      if (prev.size === customers.length) return new Set();
      return new Set(customers.map((customer) => customer.id));
    });
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function runAction(action: "remove" | "block" | "unblock") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, domainId, ids: [...selected] }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        setError(body?.error?.message ?? "Action failed.");
        return;
      }
      window.location.reload();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const anyBlockedSelected = customers.some(
    (customer) => selected.has(customer.id) && customer.blocked,
  );

  return (
    <div className="space-y-3">
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/50 px-4 py-2">
          <span className="text-sm text-muted-foreground">
            {selected.size} selected
          </span>
          <div className="ml-auto flex flex-wrap gap-2">
            {anyBlockedSelected ? (
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => runAction("unblock")}
              >
                {busy ? (
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Undo2 className="mr-1 h-3.5 w-3.5" />
                )}
                Unblock
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => runAction("block")}
              >
                {busy ? (
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Ban className="mr-1 h-3.5 w-3.5" />
                )}
                Block
              </Button>
            )}
            <Button
              variant="destructive"
              size="sm"
              disabled={busy}
              onClick={() => runAction("remove")}
            >
              {busy ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="mr-1 h-3.5 w-3.5" />
              )}
              Remove
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleAll}
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Source</TableHead>
              <TableHead className="hidden sm:table-cell">Added</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  No customers match.
                </TableCell>
              </TableRow>
            ) : (
              customers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(customer.id)}
                      onCheckedChange={() => toggleOne(customer.id)}
                      aria-label={`Select ${customer.email}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-2">
                      {customer.name || "—"}
                      {customer.blocked ? (
                        <Badge variant="outline" className="text-xs">
                          Blocked
                        </Badge>
                      ) : null}
                    </span>
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

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
