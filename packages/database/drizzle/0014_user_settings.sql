ALTER TABLE "user_settings" DROP CONSTRAINT "user_settings_owner_id_user_id_fk";
ALTER TABLE "user_settings" DROP CONSTRAINT "user_settings_pkey";
ALTER TABLE "user_settings" ALTER COLUMN "owner_id" SET DATA TYPE text;
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_pkey" PRIMARY KEY ("owner_id");
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
