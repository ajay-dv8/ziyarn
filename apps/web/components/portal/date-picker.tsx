"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@repo/ui/components/button";
import { cn } from "@repo/ui/lib/utils";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type DatePickerProps = {
  /** Days of week that are available (0=Sun, 1=Mon, ..., 6=Sat) */
  availableDays: number[];
  /** ISO date string of the currently selected date */
  selectedDate: string | null;
  /** Callback when a date is selected */
  onSelect: (date: string) => void;
  /** ISO date string — dates before this are disabled (min notice) */
  minDate?: string;
  /** ISO date string — dates after this are disabled (max advance) */
  maxDate?: string;
};

/**
 * DatePicker — simple month-grid calendar for selecting a booking date.
 * Highlights available days based on the business's booking settings.
 * Pure CSS + Tailwind, no external dependencies.
 */
export function DatePicker({
  availableDays,
  selectedDate,
  onSelect,
  minDate,
  maxDate,
}: DatePickerProps) {
  const today = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);

  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewYear, setViewYear] = useState(today.getFullYear());

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();

  function toIsoDate(year: number, month: number, day: number): string {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  }

  const cells: (number | null)[] = [];
  for (let cellIndex = 0; cellIndex < firstDayOfWeek; cellIndex++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="w-full">
      {/* Month navigation */}
      <div className="mb-3 flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={prevMonth} type="button">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>
        <Button variant="ghost" size="icon" onClick={nextMonth} type="button">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Day-of-week headers */}
      <div className="mb-1 grid grid-cols-7 gap-1">
        {DAY_NAMES.map((name) => (
          <div key={name} className="py-1 text-center text-xs font-medium text-muted-foreground">
            {name}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, index) => {
          if (day === null) {
            return <div key={`empty-${index}`} />;
          }

          const isoDate = toIsoDate(viewYear, viewMonth, day);
          const dow = new Date(viewYear, viewMonth, day).getDay();
          const isAvailable = availableDays.includes(dow);
          const isBeforeMin = minDate && isoDate < minDate;
          const isAfterMax = maxDate && isoDate > maxDate;
          const isDisabled = !isAvailable || !!isBeforeMin || !!isAfterMax;
          const isSelected = isoDate === selectedDate;

          return (
            <button
              key={isoDate}
              type="button"
              disabled={isDisabled}
              onClick={() => onSelect(isoDate)}
              className={cn(
                "flex h-9 items-center justify-center rounded-lg text-sm transition-colors",
                isSelected && "bg-primary font-medium text-primary-foreground",
                !isSelected && isAvailable && !isDisabled && "hover:bg-muted",
                isDisabled && "cursor-not-allowed text-muted-foreground/40",
                !isSelected && !isDisabled && "text-foreground",
              )}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
