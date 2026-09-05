"use client";

import Link from "next/link";
import { useState } from "react";

import { Card, CardContent } from "@repo/ui/components/card";

import { BookingsTable } from "@/components/dashboard/bookings-table";
import { ConfigureBookingButton } from "@/components/dashboard/configure-booking-button";

type Domain = { id: string; name: string };
type Booking = {
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
};
type Settings = {
  availableDays: number[];
  availableStart: string;
  availableEnd: string;
  slotDuration: number;
  minNoticeHours: number;
  maxAdvanceDays: number;
};

export function BookingsClient({
  domains,
  selectedDomainId,
  bookings,
  settings,
}: {
  domains: Domain[];
  selectedDomainId: string | null;
  bookings: Booking[];
  settings: Settings | null;
}) {
  const [bookingList, setBookingList] = useState(bookings);
  const [currentSettings, setCurrentSettings] = useState(settings);

  const selectedDomain = domains.find((domain) => domain.id === selectedDomainId) ?? domains[0];

  async function handleUpdateStatus(id: string, status: "confirmed" | "cancelled") {
    const res = await fetch(`/api/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      setBookingList((prev) =>
        prev.map((booking) => (booking.id === id ? { ...booking, status } : booking)),
      );
    }
  }

  async function handleSaveSettings(data: Settings) {
    if (!selectedDomain) return;
    const res = await fetch("/api/booking-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domainId: selectedDomain.id, ...data }),
    });
    if (res.ok) {
      setCurrentSettings(data);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bookings</h1>
          <p className="text-sm text-muted-foreground">
            Manage appointment requests and configure availability for your agents.
          </p>
        </div>
        {selectedDomain && currentSettings ? (
          <ConfigureBookingButton
            settings={currentSettings}
            onSave={handleSaveSettings}
          />
        ) : null}
      </div>

      {domains.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {domains.map((domain) => (
            <Link
              key={domain.id}
              href={`/dashboard/bookings?domainId=${domain.id}`}
              className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                selectedDomain?.id === domain.id
                  ? "border-primary bg-primary/10 font-medium text-primary"
                  : "border-input text-muted-foreground hover:text-foreground"
              }`}
            >
              {domain.name}
            </Link>
          ))}
        </div>
      ) : null}

      {!selectedDomain ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <p className="text-sm font-medium">No domains yet</p>
            <p className="text-sm text-muted-foreground">
              Create a domain first, then configure bookings for it.
            </p>
          </CardContent>
        </Card>
      ) : bookingList.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <p className="text-sm font-medium">No bookings yet</p>
            <p className="text-sm text-muted-foreground">
              When visitors book appointments through chat, they will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <BookingsTable
          bookings={bookingList}
          onUpdateStatus={handleUpdateStatus}
        />
      )}
    </div>
  );
}
