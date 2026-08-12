--> statement-breakpoint
ALTER TABLE "knowledge_documents" ADD COLUMN "file_name" text;
--> statement-breakpoint
ALTER TABLE "knowledge_documents" ADD COLUMN "file_mime" text;
--> statement-breakpoint
ALTER TABLE "knowledge_documents" ADD COLUMN "file_size" integer;
--> statement-breakpoint
ALTER TABLE "knowledge_documents" ADD COLUMN "storage_key" text;