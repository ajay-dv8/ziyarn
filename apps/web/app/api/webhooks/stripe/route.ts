import { NextResponse } from "next/server";

import { PortalServiceError } from "@repo/api/portal";

import { portalService } from "@/lib/portal-service";

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
    const { handled } = await portalService.handleStripeWebhook(rawBody, signature);
    return NextResponse.json({ received: true, handled });
  } catch (error) {
    if (error instanceof PortalServiceError) {
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
