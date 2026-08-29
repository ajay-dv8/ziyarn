import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { bookingSettingsSchema } from "@repo/api/portal/schemas";

import { authService } from "@/services/auth-service";
import { portalService } from "@/services/portal-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const session = await authService.getSession(await headers());
    if (!session) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Sign in to view booking settings" } },
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
    const settings = await portalService.getBookingSettingsForDomain(domainId);
    return NextResponse.json({ settings });
  } catch (error) {
    console.error("GET /api/booking-settings failed:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Something went wrong" } },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const session = await authService.getSession(await headers());
    if (!session) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Sign in to update booking settings" } },
        { status: 401 },
      );
    }
    const body = await request.json();
    const { domainId, ...settingsData } = body;
    if (!domainId) {
      return NextResponse.json(
        { error: { code: "INVALID_INPUT", message: "domainId is required" } },
        { status: 400 },
      );
    }
    const parsed = bookingSettingsSchema.safeParse(settingsData);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "INVALID_INPUT", message: parsed.error.issues[0]?.message ?? "Invalid input" } },
        { status: 400 },
      );
    }
    const settings = await portalService.upsertBookingSettings(domainId, parsed.data);
    return NextResponse.json({ settings });
  } catch (error) {
    console.error("PUT /api/booking-settings failed:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Something went wrong" } },
      { status: 500 },
    );
  }
}
