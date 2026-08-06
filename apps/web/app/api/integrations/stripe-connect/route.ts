import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { BillingServiceError } from "@repo/api/billing";
import { eq } from "drizzle-orm";

import { db } from "@repo/database";
import { stripeAccounts } from "@repo/database/schema";

import { authService } from "@/services/auth-service";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await authService.getSession(await headers());
    if (!session) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Sign in to view integrations" } },
        { status: 401 },
      );
    }
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new BillingServiceError(
        501,
        "BILLING_NOT_CONFIGURED",
        "Stripe is not configured for this deployment",
      );
    }
    const [account] = await db
      .select()
      .from(stripeAccounts)
      .where(eq(stripeAccounts.ownerId, session.user.id))
      .limit(1);

    if (account) {
      const { default: Stripe } = await import("stripe");
      const stripe = new Stripe(secretKey);
      const link = await stripe.accountLinks.create({
        account: account.stripeAccountId,
        refresh_url: `${process.env.BASE_APP_URL ?? "http://localhost:3000"}/dashboard/integrations`,
        return_url: `${process.env.BASE_APP_URL ?? "http://localhost:3000"}/dashboard/integrations`,
        type: "account_onboarding",
      });
      return NextResponse.json({
        connected: account.status === "complete",
        status: account.status,
        onboardingUrl: link.url,
      });
    }

    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(secretKey);
    const created = await stripe.accounts.create({
      type: "express",
      capabilities: { transfers: { requested: true } },
    });
    const [stored] = await db
      .insert(stripeAccounts)
      .values({
        ownerId: session.user.id,
        stripeAccountId: created.id,
        status: "onboarding",
      })
      .returning();
    if (!stored) {
      return NextResponse.json(
        { error: { code: "INTERNAL", message: "Could not store the account" } },
        { status: 500 },
      );
    }
    const link = await stripe.accountLinks.create({
      account: stored.stripeAccountId,
      refresh_url: `${process.env.BASE_APP_URL ?? "http://localhost:3000"}/dashboard/integrations`,
      return_url: `${process.env.BASE_APP_URL ?? "http://localhost:3000"}/dashboard/integrations`,
      type: "account_onboarding",
    });
    return NextResponse.json({
      connected: false,
      status: "onboarding",
      onboardingUrl: link.url,
    });
  } catch (error) {
    if (error instanceof BillingServiceError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status },
      );
    }
    console.error("GET /api/integrations/stripe-connect failed:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Something went wrong" } },
      { status: 500 },
    );
  }
}
