"use client";

import { useState } from "react";

import { Button } from "@repo/ui/components/button";
import { DatabaseBackup, Loader2 } from "lucide-react";

type SyncResult = {
  totalUpserted?: number;
  sources: Array<{ label: string; imported: number; error?: string }>;
};

/** Fetches orders from every connected database into the payments table. */
export function SyncDatabaseOrdersButton({
  domainId,
}: {
  domainId: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function syncOrders() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/orders/sync-database", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ domainId }),
      });
      const body = (await res.json().catch(() => null)) as
        | (SyncResult & { error?: { message?: string } })
        | null;
      if (!res.ok) {
        setError(body?.error?.message ?? "Sync failed.");
        return;
      }
      if (!body || body.sources.length === 0) {
        setError(
          "No connected databases — connect one on the Integrations page first.",
        );
        return;
      }

      const failures = body.sources.filter((s) => s.error);
      if (body.totalUpserted === 0) {
        setError(
          failures.length > 0
            ? failures.map((s) => `${s.label}: ${s.error}`).join(" · ")
            : "Nothing imported — no order rows found in the connected databases.",
        );
        return;
      }
      window.location.reload();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <Button variant="outline" onClick={syncOrders} disabled={busy}>
        {busy ? (
          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
        ) : (
          <DatabaseBackup className="mr-1.5 h-4 w-4" />
        )}
        {busy ? "Fetching…" : "Sync from database"}
      </Button>
      {error ? (
        <p className="max-w-xs text-right text-xs text-muted-foreground" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
