ALTER TABLE "products" ADD COLUMN "data_source_id" uuid;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "external_key" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "availability" text;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_data_source_id_data_sources_id_fk" FOREIGN KEY ("data_source_id") REFERENCES "public"."data_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "products_domain_external_key_idx" ON "products" USING btree ("domain_id","external_key");