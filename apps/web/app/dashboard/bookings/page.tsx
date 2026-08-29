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
  const selectedId = domains.find((d) => d.id === domainId)?.id ?? domains[0]?.id ?? null;

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
    bookings = result.bookings.map((b) => ({
      id: b.id,
      name: b.name,
      email: b.email,
      date: b.date,
      time: b.time,
      duration: b.duration,
      timezone: b.timezone,
      topic: b.topic,
      status: b.status as "pending" | "confirmed" | "cancelled",
      createdAt: b.createdAt instanceof Date ? b.createdAt.toISOString() : String(b.createdAt),
    }));
    const s = await portalService.getBookingSettingsForDomain(selectedId);
    settings = {
      availableDays: s.availableDays,
      availableStart: s.availableStart,
      availableEnd: s.availableEnd,
      slotDuration: s.slotDuration,
      minNoticeHours: s.minNoticeHours,
      maxAdvanceDays: s.maxAdvanceDays,
    };
  }

  return (
    <BookingsClient
      domains={domains.map((d) => ({ id: d.id, name: d.name }))}
      selectedId={selectedId}
      bookings={bookings}
      settings={settings}
    />
  );
}
