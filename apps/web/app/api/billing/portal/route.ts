import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { BillingServiceError } from "@repo/api/billing";

import { authService } from "@/services/auth-service";
import { billingService } from "@/services/billing-service";

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
    const { url } = await billingService.createPortalSession(session.user.id);
    return NextResponse.json({ url });
  } catch (error) {
    if (error instanceof BillingServiceError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status },
      );
    }
    console.error("POST /api/billing/portal failed:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Something went wrong" } },
      { status: 500 },
    );
  }
}
