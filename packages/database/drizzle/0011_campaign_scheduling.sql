--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "scheduled_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "campaigns" DROP CONSTRAINT "campaigns_status_check";
--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_status_check" CHECK ("status" IN ('draft', 'scheduled', 'sending', 'sent', 'cancelled'));