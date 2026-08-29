-- 0021: Add booking_settings table and duration/timezone to bookings

-- Add duration and timezone columns to existing bookings table
ALTER TABLE "bookings" ADD COLUMN "duration" integer NOT NULL DEFAULT 30;
ALTER TABLE "bookings" ADD COLUMN "timezone" text NOT NULL DEFAULT 'UTC';

-- Create booking_settings table (per-domain availability config)
CREATE TABLE IF NOT EXISTS "booking_settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "domain_id" uuid NOT NULL REFERENCES "domains"("id") ON DELETE CASCADE,
  "available_days" integer[] NOT NULL DEFAULT '{1,2,3,4,5}',
  "available_start" text NOT NULL DEFAULT '09:00',
  "available_end" text NOT NULL DEFAULT '17:00',
  "slot_duration" integer NOT NULL DEFAULT 30,
  "min_notice_hours" integer NOT NULL DEFAULT 24,
  "max_advance_days" integer NOT NULL DEFAULT 30,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "booking_settings_domain_id_idx"
  ON "booking_settings" ("domain_id");
