import { NextResponse } from "next/server";

import { PortalServiceError } from "@repo/api/portal";
import { confirmBookingSchema } from "@repo/api/portal/schemas";

import { portalService } from "@/services/portal-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = confirmBookingSchema.safeParse(await request.json());
    if (!body.success) {
      return NextResponse.json(
        { error: { code: "INVALID_INPUT", message: "Invalid booking confirmation request" } },
        { status: 400 },
      );
    }
    const booking = await portalService.confirmBooking(body.data.token);
    return NextResponse.json({ booking });
  } catch (error) {
    if (error instanceof PortalServiceError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status },
      );
    }
    console.error("POST /api/portal/booking failed:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Something went wrong" } },
      { status: 500 },
    );
  }
}
