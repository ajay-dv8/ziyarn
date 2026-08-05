"use client";

import { useState } from "react";

type PayStatus = "idle" | "loading" | "ready" | "error";

export function PaymentButton({ token }: { token: string }) {
  const [status, setStatus] = useState<PayStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function beginPayment() {
    setStatus("loading");
    setMessage(null);
    try {
      const response = await fetch(`/api/portal/pay?t=${encodeURIComponent(token)}`, {
        method: "POST",
      });
      const body = (await response.json().catch(() => null)) as {
        error?: { code?: string; message?: string };
        clientSecret?: string;
      } | null;
      if (!response.ok) {
        const code = body?.error?.code;
        if (code === "PAYMENTS_NOT_CONFIGURED" || code === "CONNECTED_ACCOUNT_REQUIRED") {
          setMessage(
            "Online payments are not enabled for this business yet — we will send you a payment link by email instead.",
          );
        } else {
          setMessage(body?.error?.message ?? "We could not start the payment. Please try again.");
        }
        setStatus("error");
        return;
      }
      if (body?.clientSecret) {
        setMessage("Almost there — our payment processor is being finalized. You will receive a payment link by email shortly.");
        setStatus("ready");
        return;
      }
      setMessage("We could not start the payment. Please try again.");
      setStatus("error");
    } catch {
      setMessage("Network error. Please try again.");
      setStatus("error");
    }
  }

  return (
    <div className="space-y-3">
      {message ? (
        <p
          className={
            status === "ready"
              ? "rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
              : "text-sm text-red-600"
          }
          role={status === "error" ? "alert" : "status"}
        >
          {message}
        </p>
      ) : null}
      <button
        type="button"
        onClick={beginPayment}
        disabled={status === "loading"}
        className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50"
      >
        {status === "loading" ? "Preparing payment…" : "Pay now"}
      </button>
    </div>
  );
}
