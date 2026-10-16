"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { Button } from "@repo/ui/components/button";

/**
 * Shown to an owner on the free plan whose payment succeeded but whose plan
 * was never applied — the browser verify call was lost (closed tab, network
 * drop) and no webhook was configured. Calls the reconcile endpoint, which
 * re-reads Paystack for a successful charge stamped with this owner's id.
 */
export function RestorePlanButton({ email }: { email: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "loading">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function restore() {
    setState("loading");
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/billing/paystack/reconcile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = (await response.json().catch(() => null)) as {
        applied?: boolean;
        message?: string;
        error?: { message?: string };
      } | null;
      if (!response.ok) {
        setError(body?.error?.message ?? "We could not check your payment.");
        setState("idle");
        return;
      }
      setMessage(body?.message ?? "Checked.");
      if (body?.applied) {
        router.refresh();
      }
      setState("idle");
    } catch {
      setError("Network error. Please try again.");
      setState("idle");
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        Paid for a plan but still on Free? We can look up your Paystack
        payment and restore it.
      </p>
      {message ? (
        <p className="text-sm text-muted-foreground" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      <Button
        variant="outline"
        onClick={restore}
        disabled={state === "loading"}
        className="w-full"
      >
        {state === "loading" ? "Checking Paystack…" : "Restore my plan"}
      </Button>
    </div>
  );
}