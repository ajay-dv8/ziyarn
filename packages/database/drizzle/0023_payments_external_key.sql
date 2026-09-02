ALTER TABLE "payments" ADD COLUMN "external_key" text;--> statement-breakpoint
CREATE UNIQUE INDEX "payments_domain_external_key_idx" ON "payments" ("domain_id","external_key");
