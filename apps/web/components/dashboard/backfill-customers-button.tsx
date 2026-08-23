"use client";

import { useState } from "react";

import { Button } from "@repo/ui/components/button";
import { Loader2, Users } from "lucide-react";

/** One-click migration of existing chat leads into the customers list. */
export function BackfillCustomersButton({ domainId }: { domainId: string }) {
  const [busy, setBusy] = useState(false);

  async function backfill() {
    setBusy(true);
    try {
      await fetch("/api/customers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "backfill", domainId }),
      });
      window.location.reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button size="sm" variant="outline" onClick={backfill} disabled={busy}>
      {busy ? (
        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
      ) : (
        <Users className="mr-1.5 h-4 w-4" />
      )}
      Import existing chat leads
    </Button>
  );
}
