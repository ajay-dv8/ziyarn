/**
 * Browser-safe Paystack helpers.
 *
 * Deliberately NOT in `apps/web/services/` — those files import
 * `@repo/database` and are server-only. Anything imported by a client
 * component must live here (or in `lib/`) so the Neon/drizzle graph never
 * enters the client bundle.
 */

export type ReconcileResult = {
  applied: boolean;
  plan: string | null;
  reference: string | null;
  message: string;
};

/**
 * Asks the server to look up a completed Paystack payment for the signed-in
 * owner and apply the plan. Used on return from a hosted checkout and by the
 * "Restore my plan" control.
 */
export async function postReconcilePaystackCheckout(): Promise<ReconcileResult> {
  const response = await fetch("/api/billing/paystack/reconcile", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });
  const body = (await response.json().catch(() => null)) as
    | (ReconcileResult & { error?: { message?: string } })
    | null;
  if (!response.ok) {
    return {
      applied: false,
      plan: null,
      reference: null,
      message:
        body?.error?.message ?? "We could not confirm your payment yet.",
    };
  }
  return {
    applied: body?.applied ?? false,
    plan: body?.plan ?? null,
    reference: body?.reference ?? null,
    message: body?.message ?? "",
  };
}