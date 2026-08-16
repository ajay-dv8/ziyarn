"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { Button } from "@repo/ui/components/button";

export function CancelSubscriptionButton() {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    if (!window.confirm("Cancel your subscription? Your domains will revert to the free plan immediately.")) {
      return;
    }
    setState("loading");
    setError(null);
    try {
      const response = await fetch("/api/billing/paystack/cancel", {
        method: "POST",
      });
      const body = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      if (!response.ok) {
        setError(body?.error?.message ?? "We could not cancel your subscription.");
        setState("error");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setState("error");
    }
  }

  return (
    <div className="space-y-2">
      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      <Button
        variant="outline"
        onClick={cancel}
        disabled={state === "loading"}
      >
        {state === "loading" ? "Cancelling…" : "Cancel subscription"}
      </Button>
    </div>
  );
}