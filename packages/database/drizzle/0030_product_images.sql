-- Nullable so existing product catalogs remain valid while owners add photos.
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "image_url" text;
