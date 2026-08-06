"use client";

import { useState } from "react";

import { Button } from "@repo/ui/components/button";

export function ManageSubscriptionButton() {
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function openPortal() {
    setState("loading");
    setError(null);
    try {
      const response = await fetch("/api/billing/portal", { method: "POST" });
      const body = (await response.json().catch(() => null)) as {
        url?: string;
        error?: { message?: string };
      } | null;
      if (!response.ok || !body?.url) {
        setError(body?.error?.message ?? "We could not open the billing portal.");
        setState("error");
        return;
      }
      window.location.href = body.url;
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
        onClick={openPortal}
        disabled={state === "loading"}
      >
        {state === "loading" ? "Opening…" : "Manage subscription"}
      </Button>
    </div>
  );
}
