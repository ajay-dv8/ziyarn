/**
 * Adds or updates an `admins` allowlist row.
 *
 * SCOPE: this does NOT create a sign-in credential. Admin auth is bound to
 * `admin_sessions` / `admin_accounts` (drizzle/0027_admin_auth_tables.sql), so
 * a row here with no matching `admin_accounts` row cannot sign in to the panel.
 * It is for changing an existing admin's role/name, or granting allowlist
 * access to an account whose credential already exists.
 *
 * To create a brand-new admin WITH a password, use the one-time /setup page
 * (available only while the admins table is empty), or build the R4
 * /admin/team invite flow. See plan/admin-roles-plan.md.
 *
 * Usage (from apps/admin):
 *   pnpm exec tsx scripts/create-admin.ts <email> [role] [name]
 *
 * Examples:
 *   pnpm exec tsx scripts/create-admin.ts ajay@example.com superadmin "Ajay"
 *   pnpm exec tsx scripts/create-admin.ts ops@example.com viewer "Ops"
 *
 * NOTE: `admins.password` is a legacy plaintext column that nothing reads and
 * which is now nullable. This script does not write it.
 */
import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import { db } from "@repo/database";
import { admins, type NewAdmin } from "@repo/database/schema";

const VALID_ROLES = ["superadmin", "admin", "viewer"] as const;
type AdminRole = (typeof VALID_ROLES)[number];

async function main(): Promise<void> {
  const [emailArg, roleArg = "admin", nameArg] = process.argv.slice(2);

  if (!emailArg) {
    console.error(
      "Usage: pnpm exec tsx scripts/create-admin.ts <email> [role] [name]",
    );
    console.error(`Roles: ${VALID_ROLES.join(" | ")}`);
    process.exit(1);
  }

  const email = emailArg.trim().toLowerCase();
  const role = roleArg as AdminRole;
  if (!VALID_ROLES.includes(role)) {
    console.error(`Invalid role "${roleArg}". Use one of: ${VALID_ROLES.join(" | ")}`);
    process.exit(1);
  }

  const localPart = email.split("@")[0] ?? email;
  const name = nameArg?.trim() || localPart;
  const now = new Date();

  const [existing] = await db
    .select({ id: admins.id })
    .from(admins)
    .where(eq(admins.email, email))
    .limit(1);

  if (existing) {
    await db
      .update(admins)
      .set({ role, name, updatedAt: now })
      .where(eq(admins.id, existing.id));
    console.log(`Updated existing admin ${email} → role=${role}`);
    return;
  }

  const newAdmin: NewAdmin = {
    id: randomUUID(),
    email,
    name,
    // No `password` field: legacy plaintext column, nullable since 0027, never
    // read. A sign-in credential lives in `admin_accounts` and must be created
    // through better-auth — see the header comment.
    role,
    emailVerified: true,
  };

  await db.insert(admins).values(newAdmin);

  console.log(`Created allowlist row ${email} with role=${role}`);
  console.log(
    "This does NOT create a sign-in credential. The account can reach /admin\n" +
      "only once it has a row in admin_accounts (see plan/admin-roles-plan.md R4).",
  );
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error("create-admin failed:", error);
    process.exit(1);
  });