ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "sender" text DEFAULT 'assistant' NOT NULL;
--> statement-breakpoint
UPDATE "messages" SET "sender" = 'visitor' WHERE "role" = 'user';
--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "owner_seen_at" timestamp with time zone DEFAULT now() NOT NULL;
