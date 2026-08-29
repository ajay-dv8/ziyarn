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
        { error: { code: "UNAUTHORIZED", message: "Sign in to view bookings" } },
        { status: 401 },
      );
    }
    const url = new URL(request.url);
    const domainId = url.searchParams.get("domainId");
    if (!domainId) {
      return NextResponse.json(
        { error: { code: "INVALID_INPUT", message: "domainId is required" } },
        { status: 400 },
      );
    }
    const status = url.searchParams.get("status") as "pending" | "confirmed" | "cancelled" | null;
    const limit = Number(url.searchParams.get("limit")) || 50;
    const offset = Number(url.searchParams.get("offset")) || 0;
    const result = await portalService.listBookings(domainId, {
      status: status ?? undefined,
      limit,
      offset,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/bookings failed:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Something went wrong" } },
      { status: 500 },
    );
  }
}
