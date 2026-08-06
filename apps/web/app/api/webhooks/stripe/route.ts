import { NextResponse } from "next/server";

import { BillingServiceError } from "@repo/api/billing";
import { PortalServiceError } from "@repo/api/portal";

import { billingService } from "@/services/billing-service";
import { portalService } from "@/services/portal-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("stripe-signature");
    if (!signature) {
      return NextResponse.json(
        { error: { code: "INVALID_INPUT", message: "Missing stripe-signature header" } },
        { status: 400 },
      );
    }
    let handled = false;
    try {
      ({ handled } = await portalService.handleStripeWebhook(rawBody, signature));
    } catch (error) {
      if (error instanceof PortalServiceError && error.status !== 400) {
        throw error;
      }
    }
    if (!handled) {
      ({ handled } = await billingService.handleStripeWebhook(rawBody, signature));
    }
    return NextResponse.json({ received: true, handled });
  } catch (error) {
    if (error instanceof PortalServiceError || error instanceof BillingServiceError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status },
      );
    }
    console.error("POST /api/webhooks/stripe failed:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Something went wrong" } },
      { status: 500 },
    );
  }
}
