CREATE TABLE "data_source_tables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"data_source_id" uuid NOT NULL,
	"table_name" text NOT NULL,
	"columns_json" jsonb,
	"row_count" integer,
	"relevant" boolean DEFAULT false NOT NULL,
	"included" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"type" text NOT NULL,
	"label" text NOT NULL,
	"host" text,
	"database_name" text,
	"credentials_encrypted" text NOT NULL,
	"status" text DEFAULT 'connected' NOT NULL,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "knowledge_documents" ADD COLUMN "data_source_id" uuid;--> statement-breakpoint
ALTER TABLE "data_source_tables" ADD CONSTRAINT "data_source_tables_data_source_id_data_sources_id_fk" FOREIGN KEY ("data_source_id") REFERENCES "public"."data_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_sources" ADD CONSTRAINT "data_sources_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "data_source_tables_data_source_id_idx" ON "data_source_tables" USING btree ("data_source_id");--> statement-breakpoint
CREATE INDEX "data_sources_agent_id_idx" ON "data_sources" USING btree ("agent_id");--> statement-breakpoint
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_data_source_id_data_sources_id_fk" FOREIGN KEY ("data_source_id") REFERENCES "public"."data_sources"("id") ON DELETE cascade ON UPDATE no action;