"use client";

import { cn } from "@repo/ui/lib/utils";

type SlotPickerProps = {
  /** Available HH:MM time strings */
  slots: string[];
  /** Currently selected slot */
  selectedSlot: string | null;
  /** Callback when a slot is selected */
  onSelect: (slot: string) => void;
  /** Loading state while fetching slots */
  loading?: boolean;
};

/**
 * SlotPicker — displays available time slots as clickable buttons.
 * Shows a grid of formatted times (e.g., "9:00 AM", "9:30 AM").
 */
export function SlotPicker({ slots, selectedSlot, onSelect, loading }: SlotPickerProps) {
  function formatTime(time: string): string {
    const [hourStr, minuteStr] = time.split(":");
    const hour = Number(hourStr);
    const minute = Number(minuteStr);
    const period = hour >= 12 ? "PM" : "AM";
    const display = hour % 12 === 0 ? 12 : hour % 12;
    return `${display}:${String(minute).padStart(2, "0")} ${period}`;
  }

  if (loading) {
    return (
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="h-10 w-24 animate-pulse rounded-lg bg-muted"
          />
        ))}
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No available slots for this date.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {slots.map((slot) => (
        <button
          key={slot}
          type="button"
          onClick={() => onSelect(slot)}
          className={cn(
            "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
            selectedSlot === slot
              ? "border-primary bg-primary text-primary-foreground"
              : "border-input hover:bg-muted",
          )}
        >
          {formatTime(slot)}
        </button>
      ))}
    </div>
  );
}
