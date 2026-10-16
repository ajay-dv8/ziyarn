import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { PaystackServiceError } from "@repo/api/paystack";
import { paystackReconcileSchema } from "@repo/api/paystack/schemas";

import { authService } from "@/services/auth-service";
import { paystackService } from "@/services/paystack-service";

export const runtime = "nodejs";

/**
 * POST /api/billing/paystack/reconcile — repair path for a payment that
 * succeeded but whose plan was never applied (lost browser verify call, or a
 * webhook that was not configured). Idempotent.
 */
export async function POST(request: Request) {
  try {
    const session = await authService.getSession(await headers());
    if (!session) {
      return NextResponse.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Sign in to restore your plan",
          },
        },
        { status: 401 },
      );
    }
    const body = (await request.json()) as { email?: unknown };
    const input = paystackReconcileSchema.safeParse({
      email: body.email ?? session.user.email,
    });
    if (!input.success) {
      return NextResponse.json(
        { error: { code: "INVALID_INPUT", message: "Invalid account email" } },
        { status: 400 },
      );
    }
    const result = await paystackService.reconcileCheckout(session.user.id, {
      email: input.data.email,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof PaystackServiceError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status },
      );
    }
    console.error("POST /api/billing/paystack/reconcile failed:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Something went wrong" } },
      { status: 500 },
    );
  }
}