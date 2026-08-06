"use client";

import { useState } from "react";

import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";

type Props = {
  campaignId: string;
  status: string;
  scheduledAt: string | Date | null;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toLocalInputValue(date: string | Date | null): string {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatScheduledAt(date: string | Date | null): string {
  if (!date) return "an unknown time";
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "an unknown time";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ScheduleCampaignControl({
  campaignId,
  status,
  scheduledAt,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [datetime, setDatetime] = useState<string>(() =>
    toLocalInputValue(scheduledAt ?? null),
  );

  async function schedule() {
    if (!datetime) {
      setError("Pick a date and time first.");
      return;
    }
    const when = new Date(datetime);
    if (Number.isNaN(when.getTime()) || when.getTime() <= Date.now()) {
      setError("Scheduled time must be in the future.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledAt: when.toISOString() }),
      });
      const body = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      if (!response.ok) {
        setError(body?.error?.message ?? "We could not schedule the campaign.");
        return;
      }
      window.location.reload();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function cancelSchedule() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/campaigns/${campaignId}/cancel-schedule`,
        { method: "POST" },
      );
      const body = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      if (!response.ok) {
        setError(body?.error?.message ?? "We could not cancel the schedule.");
        return;
      }
      window.location.reload();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      {status === "scheduled" ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Scheduled for{" "}
            <span className="font-medium text-foreground">
              {formatScheduledAt(scheduledAt)}
            </span>
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={cancelSchedule}
            disabled={loading}
          >
            {loading ? "Cancelling…" : "Cancel schedule"}
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor={`schedule-${campaignId}`} className="text-xs">
              Deliver at
            </Label>
            <Input
              id={`schedule-${campaignId}`}
              type="datetime-local"
              value={datetime}
              onChange={(event) => setDatetime(event.target.value)}
              className="w-auto min-w-[200px] text-sm"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={schedule}
            disabled={loading}
          >
            {loading ? "Scheduling…" : "Schedule"}
          </Button>
        </div>
      )}
      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}