import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { BillingServiceError } from "@repo/api/billing";
import { checkoutPlanSchema } from "@repo/api/billing/schemas";

import { authService } from "@/services/auth-service";
import { billingService } from "@/services/billing-service";

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
    const plan = checkoutPlanSchema.safeParse(body.plan);
    if (!plan.success) {
      return NextResponse.json(
        { error: { code: "INVALID_INPUT", message: "Invalid plan" } },
        { status: 400 },
      );
    }
    const { url } = await billingService.createCheckoutSession(session.user.id, {
      plan: plan.data,
      email: session.user.email,
    });
    return NextResponse.json({ url });
  } catch (error) {
    if (error instanceof BillingServiceError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status },
      );
    }
    console.error("POST /api/billing/checkout failed:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Something went wrong" } },
      { status: 500 },
    );
  }
}
