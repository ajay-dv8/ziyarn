"use client";

import { useState } from "react";

import { Button } from "@repo/ui/components/button";

export function SendCampaignButton({ campaignId }: { campaignId: string }) {
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function send() {
    if (!window.confirm("Send this campaign now? This cannot be undone.")) {
      return;
    }
    setState("loading");
    setMessage(null);
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/send`, {
        method: "POST",
      });
      const body = (await response.json().catch(() => null)) as {
        recipients?: number;
        error?: { message?: string };
      } | null;
      if (!response.ok) {
        setMessage(body?.error?.message ?? "We could not send the campaign.");
        setState("error");
        return;
      }
      setMessage(
        body?.recipients === 0
          ? "No recipients found — the campaign is marked as sent."
          : `Sent to ${body?.recipients ?? 0} recipients.`,
      );
      setState("idle");
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
            state === "error"
              ? "text-sm text-red-600"
              : "text-sm text-emerald-600"
          }
          role={state === "error" ? "alert" : "status"}
        >
          {message}
        </p>
      ) : null}
      <Button
        variant="outline"
        size="sm"
        onClick={send}
        disabled={state === "loading"}
      >
        {state === "loading" ? "Sending…" : "Send campaign"}
      </Button>
    </div>
  );
}
