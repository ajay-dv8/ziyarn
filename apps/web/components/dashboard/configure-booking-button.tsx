"use client";

import { useState } from "react";

import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui/components/dialog";
import { Settings } from "lucide-react";

import { BookingSettingsForm } from "@/components/dashboard/booking-settings-form";

type Settings = {
  availableDays: number[];
  availableStart: string;
  availableEnd: string;
  slotDuration: number;
  minNoticeHours: number;
  maxAdvanceDays: number;
};

export function ConfigureBookingButton({
  settings,
  onSave,
}: {
  settings: Settings;
  onSave: (data: Settings) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  async function handleSave(data: Settings) {
    await onSave(data);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Settings className="md:mr-1.5 h-4 w-4" />
        <span className="hidden md:block">Configure</span>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Booking Settings</DialogTitle>
          <DialogDescription>
            Configure availability hours, slot duration, and booking window for this domain.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[70vh] overflow-y-auto pr-1 -mr-1">
          <BookingSettingsForm settings={settings} onSave={handleSave} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
