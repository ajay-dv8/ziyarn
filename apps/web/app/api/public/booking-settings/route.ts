import { NextResponse } from "next/server";

import { getBookingSettings } from "@repo/api/portal/availability";
import { db } from "@repo/database";

/**
 * GET /api/public/booking-settings?domainId=X
 * Public endpoint — returns availability settings for a domain (no auth required).
 * Used by the visitor-facing booking page to know which days/hours are available.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const domainId = searchParams.get("domainId");
    if (!domainId) {
      return NextResponse.json(
        { error: { code: "MISSING_DOMAIN", message: "domainId is required" } },
        { status: 400 },
      );
    }

    const settings = await getBookingSettings(db)(domainId);
    return NextResponse.json({
      settings: {
        availableDays: settings.availableDays,
        availableStart: settings.availableStart,
        availableEnd: settings.availableEnd,
        slotDuration: settings.slotDuration,
        minNoticeHours: settings.minNoticeHours,
        maxAdvanceDays: settings.maxAdvanceDays,
      },
    });
  } catch {
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Something went wrong" } },
      { status: 500 },
    );
  }
}
