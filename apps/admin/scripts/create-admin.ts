/**
 * Creates or updates an admin on the `admins` allowlist.
 *
 * The admin panel authenticates with better-auth against the shared customer
 * tables, so a row here is what turns an ordinary sign-in into staff access.
 * Without a row, /admin redirects to /sign-in forever.
 *
 * Usage (from apps/admin):
 *   pnpm exec tsx scripts/create-admin.ts <email> [role] [name]
 *
 * Examples:
 *   pnpm exec tsx scripts/create-admin.ts ajay@example.com superadmin "Ajay"
 *   pnpm exec tsx scripts/create-admin.ts ops@example.com viewer "Ops"
 *
 * NOTE: `admins.password` is a legacy NOT NULL plaintext column that nothing
 * reads — better-auth stores the hash in `account`. This script inserts a
 * random placeholder so the constraint holds. Never put a real password here.
 */
import { randomBytes, randomUUID } from "node:crypto";

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
    // Legacy plaintext column, NOT NULL, never read by better-auth (the hash
    // lives in `account`). Random so it can never be mistaken for a credential.
    password: `!disabled:${randomBytes(24).toString("hex")}`,
    role,
    emailVerified: true,
  };

  await db.insert(admins).values(newAdmin);

  console.log(`Created admin ${email} with role=${role}`);
  console.log(
    "Now sign in with that email and a password you set through the admin sign-in form.",
  );
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error("create-admin failed:", error);
    process.exit(1);
  });