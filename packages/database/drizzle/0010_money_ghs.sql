--> statement-breakpoint
ALTER TABLE "products" DROP CONSTRAINT "products_currency_check";
--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_currency_check" CHECK ("currency" IN ('ghs', 'usd', 'eur', 'gbp'));
--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "currency" SET DEFAULT 'ghs';
--> statement-breakpoint
UPDATE "payments" SET "currency" = lower("currency");
--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "currency" SET DEFAULT 'ghs';
--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_currency_check" CHECK ("currency" IN ('ghs', 'usd', 'eur', 'gbp'));
