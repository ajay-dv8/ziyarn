"use client";

import { useState } from "react";

import { Button } from "@repo/ui/components/button";

export function ConnectStripeButton() {
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function connect() {
    setState("loading");
    setMessage(null);
    try {
      const response = await fetch("/api/integrations/stripe-connect");
      const body = (await response.json().catch(() => null)) as {
        onboardingUrl?: string;
        error?: { code?: string; message?: string };
      } | null;
      if (!response.ok || !body?.onboardingUrl) {
        setMessage(
          body?.error?.message ??
            "Stripe Connect is not enabled for this deployment yet.",
        );
        setState("error");
        return;
      }
      window.location.href = body.onboardingUrl;
    } catch {
      setMessage("Network error. Please try again.");
      setState("error");
    }
  }

  return (
    <div className="space-y-2">
      {message ? (
        <p
          className={
            state === "error" ? "text-sm text-red-600" : "text-sm text-muted-foreground"
          }
          role={state === "error" ? "alert" : "status"}
        >
          {message}
        </p>
      ) : null}
      <Button onClick={connect} disabled={state === "loading"}>
        {state === "loading" ? "Opening Stripe…" : "Connect Stripe account"}
      </Button>
    </div>
  );
}
