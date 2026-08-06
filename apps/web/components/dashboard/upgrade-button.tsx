"use client";

import { useState } from "react";

import { Button } from "@repo/ui/components/button";

export function UpgradeButton({
  plan,
  label,
  current,
}: {
  plan: "standard" | "pro" | "ultimate";
  label: string;
  current: boolean;
}) {
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function upgrade() {
    setState("loading");
    setError(null);
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const body = (await response.json().catch(() => null)) as {
        url?: string;
        error?: { message?: string };
      } | null;
      if (!response.ok || !body?.url) {
        setError(
          body?.error?.message ?? "We could not start the checkout. Please try again.",
        );
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
      {current ? (
        <Button variant="secondary" disabled>
          Current plan
        </Button>
      ) : (
        <Button
          onClick={upgrade}
          disabled={state === "loading"}
          className="w-full"
        >
          {state === "loading" ? "Redirecting…" : label}
        </Button>
      )}
    </div>
  );
}
