import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { updateBookingStatusSchema } from "@repo/api/portal/schemas";

import { authService } from "@/services/auth-service";
import { portalService } from "@/services/portal-service";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await authService.getSession(await headers());
    if (!session) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Sign in to view bookings" } },
        { status: 401 },
      );
    }
    const { id } = await params;
    const booking = await portalService.getBooking(id);
    return NextResponse.json({ booking });
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    const code = (error as { code?: string }).code ?? "INTERNAL";
    const message = (error as { message?: string }).message ?? "Something went wrong";
    return NextResponse.json({ error: { code, message } }, { status });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await authService.getSession(await headers());
    if (!session) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Sign in to update bookings" } },
        { status: 401 },
      );
    }
    const { id } = await params;
    const body = await request.json();
    const parsed = updateBookingStatusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "INVALID_INPUT", message: parsed.error.issues[0]?.message ?? "Invalid input" } },
        { status: 400 },
      );
    }
    const booking = await portalService.updateBookingStatus(id, parsed.data.status);
    return NextResponse.json({ booking });
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    const code = (error as { code?: string }).code ?? "INTERNAL";
    const message = (error as { message?: string }).message ?? "Something went wrong";
    return NextResponse.json({ error: { code, message } }, { status });
  }
}
