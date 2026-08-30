import { NextResponse } from "next/server";

import { getAvailableSlots } from "@repo/api/portal/availability";
import { db } from "@repo/database";

/**
 * GET /api/public/booking-slots?domainId=X&date=YYYY-MM-DD
 * Public endpoint — returns available time slots for a given date (no auth required).
 * Used by the visitor-facing booking page to show open slots.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const domainId = searchParams.get("domainId");
    const date = searchParams.get("date");

    if (!domainId || !date) {
      return NextResponse.json(
        { error: { code: "MISSING_PARAMS", message: "domainId and date are required" } },
        { status: 400 },
      );
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { error: { code: "INVALID_DATE", message: "date must be YYYY-MM-DD" } },
        { status: 400 },
      );
    }

    const slots = await getAvailableSlots(db)(domainId, date);
    return NextResponse.json({ slots });
  } catch {
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Something went wrong" } },
      { status: 500 },
    );
  }
}
