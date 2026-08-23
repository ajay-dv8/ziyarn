"use client";

import { useState } from "react";

import { Button } from "@repo/ui/components/button";
import { DatabaseBackup, Loader2 } from "lucide-react";

type SyncResult = {
  totalImported: number;
  sources: Array<{ label: string; imported: number; error?: string }>;
};

/** Fetches contacts from every connected database into the customer list. */
export function SyncDatabaseButton({ domainId }: { domainId: string }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function syncContacts() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "syncDatabase", domainId }),
      });
      const body = (await res.json().catch(() => null)) as
        | (SyncResult & { error?: { message?: string } })
        | null;
      if (!res.ok) {
        setError(body?.error?.message ?? "Sync failed.");
        return;
      }
      if (!body) {
        setError("Sync failed.");
        return;
      }
      if (body.sources.length === 0) {
        setError("No connected databases — connect one on the Integrations page first.");
        return;
      }
      setResult(body);
      window.location.reload();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <Button variant="outline" onClick={syncContacts} disabled={busy}>
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

      {/* Shown only on partial failure — full success reloads the page. */}
      {result && result.sources.some((s) => s.error) ? (
        <p className="max-w-xs text-right text-xs text-muted-foreground" role="status">
          Added {result.totalImported}.{" "}
          {result.sources
            .filter((s) => s.error)
            .map((s) => `${s.label}: ${s.error}`)
            .join("; ")}
        </p>
      ) : null}
    </div>
  );
}
