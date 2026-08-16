import { NextResponse } from "next/server";

import { PaystackServiceError } from "@repo/api/paystack";

import { paystackService } from "@/services/paystack-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("x-paystack-signature") ?? "";
    const result = await paystackService.handleWebhook(rawBody, signature);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof PaystackServiceError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status },
      );
    }
    console.error("POST /api/billing/paystack/webhook failed:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Something went wrong" } },
      { status: 500 },
    );
  }
}