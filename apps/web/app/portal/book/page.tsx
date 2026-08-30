"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card";
import { CheckCircle2 } from "lucide-react";

import { BookingForm } from "@/components/portal/booking-form";
import { DatePicker } from "@/components/portal/date-picker";
import { SlotPicker } from "@/components/portal/slot-picker";

type BookingSettings = {
  availableDays: number[];
  availableStart: string;
  availableEnd: string;
  slotDuration: number;
  minNoticeHours: number;
  maxAdvanceDays: number;
};

type BookingResult = {
  booking: { id: string; date: string; time: string; topic: string | null; name: string | null };
  token: string;
  url: string;
};

/**
 * /portal/book — visitor-facing self-service booking page.
 * Flow: date picker → slot picker → booking form → confirmation.
 * Query params: ?domainId=X (required)
 */
export default function BookPage({
  searchParams,
}: {
  searchParams: Promise<{ domainId?: string }>;
}) {
  const [domainId, setDomainId] = useState<string | null>(null);
  const [settings, setSettings] = useState<BookingSettings | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [result, setResult] = useState<BookingResult | null>(null);

  // Extract domainId from search params
  useEffect(() => {
    searchParams.then((params) => {
      if (params.domainId) setDomainId(params.domainId);
    });
  }, [searchParams]);

  // Fetch booking settings
  useEffect(() => {
    if (!domainId) return;
    fetch(`/api/public/booking-settings?domainId=${encodeURIComponent(domainId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.settings) setSettings(data.settings);
      })
      .catch(() => {});
  }, [domainId]);

  // Compute min/max dates for the date picker
  const minDate = useMemo(() => {
    if (!settings) return undefined;
    const now = new Date();
    now.setHours(now.getHours() + settings.minNoticeHours);
    return now.toISOString().slice(0, 10);
  }, [settings]);

  const maxDate = useMemo(() => {
    if (!settings) return undefined;
    const now = new Date();
    now.setDate(now.getDate() + settings.maxAdvanceDays);
    return now.toISOString().slice(0, 10);
  }, [settings]);

  // Fetch available slots when date is selected
  const fetchSlots = useCallback(
    async (date: string) => {
      if (!domainId) return;
      setSlotsLoading(true);
      setSelectedSlot(null);
      try {
        const res = await fetch(
          `/api/public/booking-slots?domainId=${encodeURIComponent(domainId)}&date=${date}`,
        );
        const data = await res.json();
        setSlots(data.slots ?? []);
      } catch {
        setSlots([]);
      } finally {
        setSlotsLoading(false);
      }
    },
    [domainId],
  );

  // Fetch slots when date changes
  useEffect(() => {
    if (selectedDate) {
      fetchSlots(selectedDate);
    } else {
      setSlots([]);
    }
  }, [selectedDate, fetchSlots]);

  // Format date for display
  function formatDateDisplay(date: string): string {
    const [yearStr, monthStr, dayStr] = date.split("-");
    const d = new Date(Number(yearStr), Number(monthStr) - 1, Number(dayStr));
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }

  // Format time for display
  function formatTimeDisplay(time: string): string {
    const [hourStr, minuteStr] = time.split(":");
    const hour = Number(hourStr);
    const minute = Number(minuteStr);
    const period = hour >= 12 ? "PM" : "AM";
    const display = hour % 12 === 0 ? 12 : hour % 12;
    return `${display}:${String(minute).padStart(2, "0")} ${period}`;
  }

  if (!domainId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <p className="text-sm font-medium">Missing domain</p>
            <p className="text-sm text-muted-foreground">
              This page requires a domainId query parameter.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">Loading booking settings...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Confirmation screen
  if (result) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-500" />
            <div>
              <h2 className="text-lg font-semibold">Booking confirmed!</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Your appointment has been scheduled.
              </p>
            </div>
            <div className="w-full rounded-lg bg-muted/50 p-4 text-left text-sm">
              <p>
                <span className="text-muted-foreground">Date: </span>
                <span className="font-medium">{formatDateDisplay(result.booking.date)}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Time: </span>
                <span className="font-medium">{formatTimeDisplay(result.booking.time)}</span>
              </p>
              {result.booking.topic ? (
                <p>
                  <span className="text-muted-foreground">Topic: </span>
                  <span className="font-medium">{result.booking.topic}</span>
                </p>
              ) : null}
              {result.booking.name ? (
                <p>
                  <span className="text-muted-foreground">Name: </span>
                  <span className="font-medium">{result.booking.name}</span>
                </p>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              A confirmation link has been sent to your email if provided.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-start justify-center bg-muted/30 p-4 pt-16">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Book an appointment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Step 1: Date picker */}
          <div>
            <p className="mb-2 text-sm font-medium">1. Select a date</p>
            <DatePicker
              availableDays={settings.availableDays}
              selectedDate={selectedDate}
              onSelect={(date) => {
                setSelectedDate(date);
                setSelectedSlot(null);
              }}
              minDate={minDate}
              maxDate={maxDate}
            />
          </div>

          {/* Step 2: Slot picker */}
          {selectedDate ? (
            <div>
              <p className="mb-2 text-sm font-medium">
                2. Select a time
                {selectedDate ? ` for ${formatDateDisplay(selectedDate)}` : ""}
              </p>
              <SlotPicker
                slots={slots}
                selectedSlot={selectedSlot}
                onSelect={setSelectedSlot}
                loading={slotsLoading}
              />
            </div>
          ) : null}

          {/* Step 3: Booking form */}
          {selectedDate && selectedSlot ? (
            <div>
              <p className="mb-2 text-sm font-medium">3. Your details</p>
              <BookingForm
                date={selectedDate}
                time={selectedSlot}
                domainId={domainId}
                onBooked={setResult}
              />
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
