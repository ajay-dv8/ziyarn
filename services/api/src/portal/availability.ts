import { and, eq, inArray } from "drizzle-orm";

import type { Database } from "@repo/database";
import {
  bookings,
  bookingSettings,
  type BookingSetting,
} from "@repo/database/schema";

const DEFAULT_SETTINGS: Omit<
  BookingSetting,
  "id" | "domainId" | "createdAt" | "updatedAt"
> = {
  availableDays: [1, 2, 3, 4, 5],
  availableStart: "09:00",
  availableEnd: "17:00",
  slotDuration: 30,
  minNoticeHours: 24,
  maxAdvanceDays: 30,
};

/** Day-of-week number (0 = Sunday) */
function dayOfWeek(dateStr: string): number {
  const parts = dateStr.split("-");
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  return new Date(y, m - 1, d).getDay();
}

/** Parse "HH:MM" → total minutes from midnight */
function toMinutes(time: string): number {
  const parts = time.split(":");
  const h = Number(parts[0] ?? 0);
  const m = Number(parts[1] ?? 0);
  return h * 60 + m;
}

/** Format total minutes as "HH:MM" */
function padTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export type AvailabilityError =
  | { code: "OUTSIDE_HOURS"; message: string }
  | { code: "DAY_NOT_AVAILABLE"; message: string }
  | { code: "SLOT_TAKEN"; message: string }
  | { code: "TOO_SOON"; message: string }
  | { code: "TOO_FAR"; message: string };

export function getBookingSettings(db: Database) {
  return async function getBookingSettings(
    domainId: string,
  ): Promise<typeof DEFAULT_SETTINGS & { id: string; domainId: string; createdAt: Date; updatedAt: Date }> {
    const [row] = await db
      .select()
      .from(bookingSettings)
      .where(eq(bookingSettings.domainId, domainId))
      .limit(1);
    if (row) return row;
    return {
      id: "",
      domainId,
      ...DEFAULT_SETTINGS,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  };
}

/**
 * Generate available slots for a given date.
 * Returns HH:MM strings that fall on available days within configured hours,
 * excluding slots that overlap with existing bookings.
 */
export function getAvailableSlots(db: Database) {
  return async function getAvailableSlots(
    domainId: string,
    date: string,
  ): Promise<string[]> {
    const settings = await getBookingSettings(db)(domainId);
    const dow = dayOfWeek(date);
    if (!settings.availableDays.includes(dow)) return [];

    const start = toMinutes(settings.availableStart);
    const end = toMinutes(settings.availableEnd);
    const dur = settings.slotDuration;
    const allSlots: string[] = [];
    for (let t = start; t + dur <= end; t += dur) {
      allSlots.push(padTime(t));
    }
    if (allSlots.length === 0) return [];

    const booked = await db
      .select({ time: bookings.time })
      .from(bookings)
      .where(
        and(
          eq(bookings.domainId, domainId),
          eq(bookings.date, date),
          inArray(bookings.status, ["pending", "confirmed"]),
        ),
      );
    const taken = new Set(booked.map((b) => b.time));
    return allSlots.filter((s) => !taken.has(s));
  };
}

/**
 * Check if a specific date+time slot is available.
 * Returns null if available, or an error describing why not.
 */
export function checkSlotAvailable(db: Database) {
  return async function checkSlotAvailable(
    domainId: string,
    date: string,
    time: string,
  ): Promise<AvailabilityError | null> {
    const settings = await getBookingSettings(db)(domainId);
    const dow = dayOfWeek(date);
    if (!settings.availableDays.includes(dow)) {
      return {
        code: "DAY_NOT_AVAILABLE",
        message: `Bookings are not available on this day of the week`,
      };
    }

    const startMin = toMinutes(settings.availableStart);
    const endMin = toMinutes(settings.availableEnd);
    const timeMin = toMinutes(time);
    if (timeMin < startMin || timeMin + settings.slotDuration > endMin) {
      return {
        code: "OUTSIDE_HOURS",
        message: `Available hours are ${settings.availableStart}–${settings.availableEnd}`,
      };
    }

    const now = new Date();
    const dateParts = date.split("-");
    const timeParts = time.split(":");
    const y = Number(dateParts[0]);
    const m = Number(dateParts[1]);
    const d = Number(dateParts[2]);
    const hh = Number(timeParts[0]);
    const mm = Number(timeParts[1]);
    const slotDate = new Date(y, m - 1, d, hh, mm);
    const diffMs = slotDate.getTime() - now.getTime();
    const diffH = diffMs / (1000 * 60 * 60);
    if (diffH < settings.minNoticeHours) {
      return {
        code: "TOO_SOON",
        message: `Bookings must be made at least ${settings.minNoticeHours} hours in advance`,
      };
    }

    const maxDate = new Date(now);
    maxDate.setDate(maxDate.getDate() + settings.maxAdvanceDays);
    if (slotDate > maxDate) {
      return {
        code: "TOO_FAR",
        message: `Bookings can only be made up to ${settings.maxAdvanceDays} days in advance`,
      };
    }

    const taken = await db
      .select({ id: bookings.id })
      .from(bookings)
      .where(
        and(
          eq(bookings.domainId, domainId),
          eq(bookings.date, date),
          eq(bookings.time, time),
          inArray(bookings.status, ["pending", "confirmed"]),
        ),
      )
      .limit(1);
    if (taken.length > 0) {
      return {
        code: "SLOT_TAKEN",
        message: "That time slot is already booked",
      };
    }

    return null;
  };
}
