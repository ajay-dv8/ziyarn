import { createHmac } from "node:crypto";

import { NextResponse } from "next/server";

import { checkSlotAvailable } from "@repo/api/portal/availability";
import { createBookingSchema } from "@repo/api/portal/schemas";
import { db } from "@repo/database";
import { bookings } from "@repo/database/schema";

/**
 * POST /api/public/bookings
 * Public endpoint — creates a booking directly (no auth required).
 * Accepts { domainId, date, time, name?, email?, topic? }.
 * Validates the slot, inserts the booking, returns the portal confirmation URL.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = createBookingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "INVALID_INPUT", message: parsed.error.issues[0]?.message ?? "Invalid input" } },
        { status: 400 },
      );
    }

    const data = parsed.data;

    // Check slot availability
    const slotError = await checkSlotAvailable(db)(data.domainId, data.date, data.time);
    if (slotError) {
      return NextResponse.json(
        { error: { code: slotError.code, message: slotError.message } },
        { status: 409 },
      );
    }

    // Insert booking
    const [booking] = await db
      .insert(bookings)
      .values({
        domainId: data.domainId,
        conversationId: data.conversationId ?? null,
        name: data.name ?? null,
        email: data.email ?? null,
        date: data.date,
        time: data.time,
        duration: data.duration ?? 30,
        timezone: data.timezone ?? "UTC",
        topic: data.topic ?? null,
      })
      .returning();
    if (!booking) {
      return NextResponse.json(
        { error: { code: "CREATE_FAILED", message: "Failed to create booking" } },
        { status: 500 },
      );
    }

    // Sign portal token (same pattern as portal service)
    const secret = process.env.PORTAL_URL_SECRET ?? process.env.BETTER_AUTH_SECRET;
    if (!secret) {
      return NextResponse.json(
        { error: { code: "INTERNAL", message: "Portal secret not configured" } },
        { status: 500 },
      );
    }
    const tokenTtlMs = 7 * 24 * 60 * 60 * 1000;
    const tokenPayload = {
      type: "booking" as const,
      id: booking.id,
      domainId: booking.domainId,
      exp: Date.now() + tokenTtlMs,
    };
    const encoded = Buffer.from(JSON.stringify(tokenPayload), "utf-8").toString("base64url");
    const signature = createHmac("sha256", secret).update(encoded).digest("base64url");
    const token = `${encoded}.${signature}`;

    const baseUrl = process.env.BASE_APP_URL ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
    const url = `${baseUrl}/portal/booking?t=${encodeURIComponent(token)}`;

    return NextResponse.json({ booking, token, url });
  } catch {
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Something went wrong" } },
      { status: 500 },
    );
  }
}
