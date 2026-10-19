import type { Metadata } from "next";
import { headers } from "next/headers";

import { BookingsClient } from "@/components/dashboard/bookings-client";
import { authService } from "@/services/auth-service";
import { domainsService } from "@/services/domains-service";
import { portalService } from "@/services/portal-service";

export const metadata: Metadata = {
  title: "Bookings",
};

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ domainId?: string }>;
}) {
  const requestHeaders = await headers();
  const session = await authService.getSession(requestHeaders);
  if (!session) return null;

  const domains = await domainsService.listDomains(requestHeaders);
  const { domainId } = await searchParams;
  const selectedId = domains.find((domain) => domain.id === domainId)?.id ?? domains[0]?.id ?? null;

  let bookings: {
    id: string;
    name: string | null;
    email: string | null;
    date: string;
    time: string;
    duration: number;
    timezone: string;
    topic: string | null;
    status: "pending" | "confirmed" | "cancelled";
    createdAt: string;
  }[] = [];
  let settings: {
    availableDays: number[];
    availableStart: string;
    availableEnd: string;
    slotDuration: number;
    minNoticeHours: number;
    maxAdvanceDays: number;
  } | null = null;

  if (selectedId) {
    const result = await portalService.listBookings(selectedId, { limit: 100 });
    bookings = result.bookings.map((booking) => ({
      id: booking.id,
      name: booking.name,
      email: booking.email,
      date: booking.date,
      time: booking.time,
      duration: booking.duration,
      timezone: booking.timezone,
      topic: booking.topic,
      status: booking.status as "pending" | "confirmed" | "cancelled",
      createdAt: booking.createdAt instanceof Date ? booking.createdAt.toISOString() : String(booking.createdAt),
    }));
    const settingsResult = await portalService.getBookingSettingsForDomain(selectedId);
    settings = {
      availableDays: settingsResult.availableDays,
      availableStart: settingsResult.availableStart,
      availableEnd: settingsResult.availableEnd,
      slotDuration: settingsResult.slotDuration,
      minNoticeHours: settingsResult.minNoticeHours,
      maxAdvanceDays: settingsResult.maxAdvanceDays,
    };
  }

  return (
    <BookingsClient
      domains={domains.map((domain) => ({ id: domain.id, name: domain.name }))}
      selectedDomainId={selectedId}
      bookings={bookings}
      settings={settings}
    />
  );
}
