import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { authService } from "@/services/auth-service";
import { portalService } from "@/services/portal-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const session = await authService.getSession(await headers());
    if (!session) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Sign in to view available slots" } },
        { status: 401 },
      );
    }
    const url = new URL(request.url);
    const domainId = url.searchParams.get("domainId");
    const date = url.searchParams.get("date");
    if (!domainId || !date) {
      return NextResponse.json(
        { error: { code: "INVALID_INPUT", message: "domainId and date are required" } },
        { status: 400 },
      );
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { error: { code: "INVALID_INPUT", message: "date must be YYYY-MM-DD" } },
        { status: 400 },
      );
    }
    const slots = await portalService.getAvailableSlotsForDomain(domainId, date);
    return NextResponse.json({ slots });
  } catch (error) {
    console.error("GET /api/booking-settings/slots failed:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Something went wrong" } },
      { status: 500 },
    );
  }
}
