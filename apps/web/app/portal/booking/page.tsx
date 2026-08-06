import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PortalServiceError } from "@repo/api/portal";

import { BookingConfirmButton } from "@/components/portal/booking-confirm-button";
import { portalService } from "@/services/portal-service";

export const metadata: Metadata = {
  title: "Confirm your appointment",
};

function formatDate(date: string): string {
  const [year, month, day] = date.split("-");
  if (!year || !month || !day) return date;
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))).toLocaleDateString(
    "en-US",
    { weekday: "long", year: "numeric", month: "long", day: "numeric" },
  );
}

export default async function PortalBookingPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t: token } = await searchParams;
  if (!token) notFound();

  let booking: Awaited<ReturnType<typeof portalService.getBookingByToken>>;
  try {
    booking = await portalService.getBookingByToken(token);
  } catch (error) {
    if (error instanceof PortalServiceError) {
      notFound();
    }
    throw error;
  }

  const { booking: appointment, domainName } = booking;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-medium text-zinc-500">{domainName}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900">
          Confirm your appointment
        </h1>

        {appointment.status === "confirmed" ? (
          <div className="mt-6">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              This appointment is confirmed. We look forward to meeting you.
            </div>
            <dl className="mt-6 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500">Date</dt>
                <dd className="font-medium text-zinc-900">{formatDate(appointment.date)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500">Time</dt>
                <dd className="font-medium text-zinc-900">{appointment.time}</dd>
              </div>
              {appointment.topic ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-zinc-500">Topic</dt>
                  <dd className="text-right font-medium text-zinc-900">{appointment.topic}</dd>
                </div>
              ) : null}
            </dl>
          </div>
        ) : (
          <>
            <dl className="mt-6 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500">Date</dt>
                <dd className="font-medium text-zinc-900">{formatDate(appointment.date)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500">Time</dt>
                <dd className="font-medium text-zinc-900">{appointment.time}</dd>
              </div>
              {appointment.topic ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-zinc-500">Topic</dt>
                  <dd className="text-right font-medium text-zinc-900">{appointment.topic}</dd>
                </div>
              ) : null}
            </dl>
            <p className="mt-6 text-sm text-zinc-500">
              Please confirm this appointment so we can prepare for your visit.
            </p>
            <div className="mt-4">
              <BookingConfirmButton token={token} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
