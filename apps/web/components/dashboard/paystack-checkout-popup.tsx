"use client";

import { useEffect, useRef, useState } from "react";

import { usePaystackPayment } from "react-paystack";

import { Button } from "@repo/ui/components/button";

const PAYSTACK_PUBLIC_KEY = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY ?? "";

export type PaystackCheckout = {
  reference: string;
  planCode: string;
  amountKobo: number;
  email: string;
  currency: string;
  url: string;
  /**
   * True when the Paystack plan charges a different amount than
   * PAYSTACK_PRICE_* expects. Shown so a misconfigured dashboard or env is
   * visible to the owner before they pay.
   */
  priceDrifted?: boolean;
};

/**
 * Opens the Paystack inline popup on mount. Loaded with `ssr: false` from
 * the upgrade button because react-paystack reads `window` at module scope
 * and would crash server-side module evaluation.
 */
export function PaystackCheckoutPopup({
  checkout,
  onSuccess,
  onClose,
  onError,
}: {
  checkout: PaystackCheckout;
  onSuccess: () => void;
  onClose: () => void;
  onError: (message: string) => void;
}) {
  const [state, setState] = useState<"opening" | "open">("opening");
  const initializePayment = usePaystackPayment({ publicKey: PAYSTACK_PUBLIC_KEY });
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) {
      return;
    }
    startedRef.current = true;
    if (!PAYSTACK_PUBLIC_KEY) {
      onError("Paystack is not configured for this deployment.");
      return;
    }
    setState("open");
    initializePayment({
      config: {
        email: checkout.email,
        amount: checkout.amountKobo,
        reference: checkout.reference,
        plan: checkout.planCode,
        currency: checkout.currency,
      },
      onSuccess: () => {
        onSuccess();
      },
      onClose: () => {
        onClose();
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-2">
      {state === "opening" ? (
        <p className="text-sm text-muted-foreground">Opening Paystack…</p>
      ) : null}
      {checkout.priceDrifted ? (
        <p className="text-sm text-amber-600" role="status">
          Heads up: the price on the Paystack checkout differs from the price
          shown on this page. The Paystack amount is what you will be charged.
        </p>
      ) : null}
      {checkout.url ? (
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => {
            window.location.href = checkout.url;
          }}
        >
          Continue on Paystack
        </Button>
      ) : null}
      <Button
        variant="ghost"
        className="w-full"
        onClick={onClose}
      >
        Cancel
      </Button>
    </div>
  );
}