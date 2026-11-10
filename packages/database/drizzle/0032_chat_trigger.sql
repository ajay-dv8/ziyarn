ALTER TABLE "domains" ADD COLUMN IF NOT EXISTS "chat_trigger" text DEFAULT 'default' NOT NULL;--> statement-breakpoint
ALTER TABLE "domains" ADD COLUMN IF NOT EXISTS "chat_trigger_config" jsonb DEFAULT '{}'::jsonb NOT NULL;
