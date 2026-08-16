import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { PaystackServiceError } from "@repo/api/paystack";

import { authService } from "@/services/auth-service";
import { paystackService } from "@/services/paystack-service";

export const runtime = "nodejs";

export async function POST() {
  try {
    const session = await authService.getSession(await headers());
    if (!session) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Sign in to manage your subscription" } },
        { status: 401 },
      );
    }
    await paystackService.cancelSubscription(session.user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof PaystackServiceError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status },
      );
    }
    console.error("POST /api/billing/paystack/cancel failed:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Something went wrong" } },
      { status: 500 },
    );
  }
}