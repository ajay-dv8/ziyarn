import { NextResponse } from "next/server";

import { PortalServiceError } from "@repo/api/portal";

import { portalService } from "@/lib/portal-service";

export const runtime = "nodejs";

function tokenFromRequest(request: Request): string | null {
  return new URL(request.url).searchParams.get("t");
}

export async function GET(request: Request) {
  const token = tokenFromRequest(request);
  if (!token) {
    return NextResponse.json(
      { error: { code: "INVALID_INPUT", message: "Missing portal token" } },
      { status: 400 },
    );
  }
  try {
    const { payment, domainName } = await portalService.getPaymentByToken(token);
    return NextResponse.json({ payment, domainName });
  } catch (error) {
    if (error instanceof PortalServiceError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status },
      );
    }
    console.error("GET /api/portal/pay failed:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Something went wrong" } },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const token = tokenFromRequest(request);
  if (!token) {
    return NextResponse.json(
      { error: { code: "INVALID_INPUT", message: "Missing portal token" } },
      { status: 400 },
    );
  }
  try {
    const { clientSecret, publishableKey } = await portalService.createPaymentIntent(token);
    return NextResponse.json({ clientSecret, publishableKey });
  } catch (error) {
    if (error instanceof PortalServiceError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status },
      );
    }
    console.error("POST /api/portal/pay failed:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Something went wrong" } },
      { status: 500 },
    );
  }
}
