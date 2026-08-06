CREATE TABLE IF NOT EXISTS "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domain_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price_cents" integer NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_price_cents_check" CHECK ("price_cents" >= 0),
	CONSTRAINT "products_currency_check" CHECK ("currency" IN ('usd', 'eur', 'gbp'))
);
--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "domains"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "products_domain_id_idx" ON "products" USING btree ("domain_id");
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "answers" jsonb;
--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "filter_questions" jsonb;