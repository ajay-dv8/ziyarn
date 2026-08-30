"use client";

import { useState } from "react";

import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";

type BookingFormProps = {
  /** Selected date (YYYY-MM-DD) */
  date: string;
  /** Selected time (HH:MM) */
  time: string;
  /** Domain ID to book against */
  domainId: string;
  /** Callback on successful booking creation */
  onBooked: (result: { booking: { id: string; date: string; time: string; topic: string | null; name: string | null }; token: string; url: string }) => void;
};

type FormErrors = {
  name?: string;
  email?: string;
  topic?: string;
};

/**
 * BookingForm — collects visitor details (name, email, topic) and submits
 * the booking to the public API. Shows validation errors inline.
 */
export function BookingForm({ date, time, domainId, onBooked }: BookingFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  function validate(): boolean {
    const next: FormErrors = {};
    if (name.trim().length > 200) next.name = "Name must be 200 characters or less";
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = "Please enter a valid email";
    if (topic.trim().length > 500) next.topic = "Topic must be 500 characters or less";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setServerError(null);

    try {
      const response = await fetch("/api/public/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domainId,
          date,
          time,
          name: name.trim() || undefined,
          email: email.trim() || undefined,
          topic: topic.trim() || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setServerError(data.error?.message ?? "Failed to create booking");
        return;
      }
      onBooked(data);
    } catch {
      setServerError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="booking-name" className="mb-1 block text-sm font-medium">
          Name
        </label>
        <Input
          id="booking-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Your name (optional)"
        />
        {errors.name ? <p className="mt-1 text-xs text-destructive">{errors.name}</p> : null}
      </div>

      <div>
        <label htmlFor="booking-email" className="mb-1 block text-sm font-medium">
          Email
        </label>
        <Input
          id="booking-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="your@email.com (optional)"
        />
        {errors.email ? <p className="mt-1 text-xs text-destructive">{errors.email}</p> : null}
      </div>

      <div>
        <label htmlFor="booking-topic" className="mb-1 block text-sm font-medium">
          Topic
        </label>
        <Input
          id="booking-topic"
          value={topic}
          onChange={(event) => setTopic(event.target.value)}
          placeholder="What is this about? (optional)"
        />
        {errors.topic ? <p className="mt-1 text-xs text-destructive">{errors.topic}</p> : null}
      </div>

      {serverError ? (
        <p className="text-sm text-destructive">{serverError}</p>
      ) : null}

      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? "Booking..." : "Confirm booking"}
      </Button>
    </form>
  );
}
