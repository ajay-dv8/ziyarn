"use client";

import { useState } from "react";

import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_VALUES = [0, 1, 2, 3, 4, 5, 6];

type Settings = {
  availableDays: number[];
  availableStart: string;
  availableEnd: string;
  slotDuration: number;
  minNoticeHours: number;
  maxAdvanceDays: number;
};

export function BookingSettingsForm({
  settings,
  onSave,
}: {
  settings: Settings;
  onSave: (data: Settings) => Promise<void>;
}) {
  const [form, setForm] = useState<Settings>({ ...settings });
  const [saving, setSaving] = useState(false);

  function toggleDay(day: number) {
    setForm((previousForm) => ({
      ...previousForm,
      availableDays: previousForm.availableDays.includes(day)
        ? previousForm.availableDays.filter((d) => d !== day)
        : [...previousForm.availableDays, day].sort(),
    }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  }

  const minNoticeDays = Math.round(form.minNoticeHours / 24);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium">Available Days</p>
          <p className="text-xs text-muted-foreground">
            Select the days visitors can book appointments.
          </p>
        </div>
        <div className="flex gap-1.5">
          {DAY_VALUES.map((day) => (
            <Button
              key={day}
              type="button"
              size="sm"
              variant={form.availableDays.includes(day) ? "default" : "outline"}
              onClick={() => toggleDay(day)}
              className="h-9 flex-1 text-xs font-medium"
            >
              {DAY_NAMES[day]}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium">Working Hours</p>
          <p className="text-xs text-muted-foreground">
            The time window when appointments can be scheduled.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="start" className="text-xs text-muted-foreground">
              Opens at
            </Label>
            <Input
              id="start"
              type="time"
              value={form.availableStart}
              onChange={(event) =>
                setForm((previousForm) => ({
                  ...previousForm,
                  availableStart: event.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="end" className="text-xs text-muted-foreground">
              Closes at
            </Label>
            <Input
              id="end"
              type="time"
              value={form.availableEnd}
              onChange={(event) =>
                setForm((previousForm) => ({
                  ...previousForm,
                  availableEnd: event.target.value,
                }))
              }
            />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium">Scheduling Rules</p>
          <p className="text-xs text-muted-foreground">
            Control slot length and how far in advance visitors can book.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="duration" className="text-xs text-muted-foreground">
              Slot length
            </Label>
            <select
              id="duration"
              value={form.slotDuration}
              onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
                setForm((previousForm) => ({
                  ...previousForm,
                  slotDuration: Number(event.target.value),
                }))
              }
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {[15, 30, 45, 60, 90, 120].map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes} min
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notice" className="text-xs text-muted-foreground">
              Minimum notice
            </Label>
            <div className="relative">
              <Input
                id="notice"
                type="number"
                min={0}
                max={30}
                value={minNoticeDays}
                onChange={(event) =>
                  setForm((previousForm) => ({
                    ...previousForm,
                    minNoticeHours: Number(event.target.value) * 24,
                  }))
                }
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                day{minNoticeDays !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="advance" className="text-xs text-muted-foreground">
              Max advance
            </Label>
            <div className="relative">
              <Input
                id="advance"
                type="number"
                min={1}
                max={90}
                value={form.maxAdvanceDays}
                onChange={(event) =>
                  setForm((previousForm) => ({
                    ...previousForm,
                    maxAdvanceDays: Number(event.target.value),
                  }))
                }
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                day{form.maxAdvanceDays !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving} className="w-full">
        {saving ? "Saving..." : "Save Settings"}
      </Button>
    </div>
  );
}
