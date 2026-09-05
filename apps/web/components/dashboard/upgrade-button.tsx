"use client";

import { useState } from "react";

import dynamic from "next/dynamic";

import { useRouter } from "next/navigation";

import { Button } from "@repo/ui/components/button";

import type { PaystackCheckout } from "@/components/dashboard/paystack-checkout-popup";

const PAYSTACK_PUBLIC_KEY = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY ?? "";

const Popup = dynamic(
  () =>
    import("@/components/dashboard/paystack-checkout-popup").then(
      (module) => module.PaystackCheckoutPopup,
    ),
  { ssr: false },
);

export function UpgradeButton({
  plan,
  label,
  current,
  email,
}: {
  plan: "standard" | "pro" | "ultimate";
  label: string;
  current: boolean;
  email: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [checkout, setCheckout] = useState<PaystackCheckout | null>(null);

  async function upgrade() {
    setState("loading");
    setError(null);
    try {
      const response = await fetch("/api/billing/paystack/initialize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const body = (await response.json().catch(() => null)) as (PaystackCheckout & {
        error?: { message?: string };
      }) | null;
      if (!response.ok || !body?.reference || !body.planCode || !body.amountKobo) {
        setError(
          body?.error?.message ?? "We could not start the checkout. Please try again.",
        );
        setState("error");
        return;
      }
      if (!PAYSTACK_PUBLIC_KEY) {
        if (body.url) {
          window.location.href = body.url;
          return;
        }
        setError("Paystack is not configured for this deployment.");
        setState("error");
        return;
      }
      setCheckout({ ...body, email: body.email ?? email });
    } catch {
      setError("Network error. Please try again.");
      setState("error");
    }
  }

  async function handleSuccess() {
    if (!checkout) {
      return;
    }
    try {
      const verify = await fetch("/api/billing/paystack/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reference: checkout.reference }),
      });
      const verified = (await verify.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      if (!verify.ok) {
        setError(
          verified?.error?.message ??
            "Payment succeeded but we could not activate your plan. Please contact support.",
        );
        setState("error");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error while confirming your payment. Please contact support.");
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
      ) : checkout ? (
        <Popup
          checkout={checkout}
          onSuccess={handleSuccess}
          onClose={() => {
            setCheckout(null);
            setState("idle");
          }}
          onError={(message) => {
            setError(message);
            setState("error");
          }}
        />
      ) : (
        <Button
          onClick={upgrade}
          disabled={state === "loading"}
          className="w-full"
        >
          {state === "loading" ? "Preparing…" : label}
        </Button>
      )}
    </div>
  );
}