"use client";

import { useEffect, useRef } from "react";

import { useRouter, useSearchParams } from "next/navigation";

import { toast } from "sonner";

import { APP_ROUTES } from "@/constants/routes";
import { postReconcilePaystackCheckout } from "@/lib/paystack-client";

/**
 * Fires when the billing page is loaded with `?paystack=return` — the
 * callback_url set on transaction initialize. Paystack redirects the customer
 * back here after a hosted checkout, where we reconcile the charge server-side.
 *
 * The `reference` query param Paystack appends is used only for display; the
 * reconcile endpoint re-reads Paystack and authorizes on server-owned metadata.
 */
export function PaystackReturnHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const handledRef = useRef(false);

  const returned = searchParams.get("paystack") === "return";
  const reference = searchParams.get("reference");

  useEffect(() => {
    if (!returned || handledRef.current) {
      return;
    }
    handledRef.current = true;

    void postReconcilePaystackCheckout().then((result) => {
      if (result.applied) {
        toast.success("Payment received — your plan is now active.");
        router.refresh();
      } else if (result.message) {
        toast.error(result.message);
      }
      // Drop the query params so a refresh does not re-run the check.
      router.replace(APP_ROUTES.DASHBOARD_BILLING);
    });
  }, [returned, router]);

  if (!returned) {
    return null;
  }

  return (
    <p className="text-sm text-muted-foreground" role="status">
      Confirming your payment
      {reference ? ` (${reference})` : ""}…
    </p>
  );
}