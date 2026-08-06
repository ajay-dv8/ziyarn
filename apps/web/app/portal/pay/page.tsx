import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PortalServiceError } from "@repo/api/portal";

import { PaymentButton } from "@/components/portal/payment-button";
import { portalService } from "@/services/portal-service";

export const metadata: Metadata = {
  title: "Secure payment",
};

function formatAmount(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amountMinor / 100);
}

export default async function PortalPayPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t: token } = await searchParams;
  if (!token) notFound();

  let data: Awaited<ReturnType<typeof portalService.getPaymentByToken>>;
  try {
    data = await portalService.getPaymentByToken(token);
  } catch (error) {
    if (error instanceof PortalServiceError) {
      notFound();
    }
    throw error;
  }

  const { payment, domainName } = data;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-medium text-zinc-500">{domainName}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">
          {payment.status === "paid" ? "Payment received" : "Complete your payment"}
        </h1>

        <dl className="mt-6 space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-500">Amount</dt>
            <dd className="text-lg font-semibold text-zinc-900">
              {formatAmount(payment.amountMinor, payment.currency)}
            </dd>
          </div>
          {payment.description ? (
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">For</dt>
              <dd className="text-right font-medium text-zinc-900">{payment.description}</dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-500">Status</dt>
            <dd className="font-medium text-zinc-900">{payment.status}</dd>
          </div>
        </dl>

        {payment.status === "paid" ? (
          <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Thank you — your payment has been received.
          </div>
        ) : (
          <div className="mt-6">
            <PaymentButton token={token} />
          </div>
        )}
      </div>
    </div>
  );
}
