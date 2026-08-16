import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { PaystackServiceError } from "@repo/api/paystack";
import { paystackInitializeSchema } from "@repo/api/paystack/schemas";

import { authService } from "@/services/auth-service";
import { paystackService } from "@/services/paystack-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = await authService.getSession(await headers());
    if (!session) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Sign in to upgrade your plan" } },
        { status: 401 },
      );
    }
    const body = (await request.json()) as { plan?: unknown };
    const input = paystackInitializeSchema.safeParse(body);
    if (!input.success) {
      return NextResponse.json(
        { error: { code: "INVALID_INPUT", message: "Invalid plan" } },
        { status: 400 },
      );
    }
    const checkout = await paystackService.initializeCheckout(session.user.id, {
      plan: input.data.plan,
      email: session.user.email,
    });
    return NextResponse.json(checkout);
  } catch (error) {
    if (error instanceof PaystackServiceError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status },
      );
    }
    console.error("POST /api/billing/paystack/initialize failed:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Something went wrong" } },
      { status: 500 },
    );
  }
}