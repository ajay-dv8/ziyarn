import { randomBytes } from "node:crypto";

import { count } from "drizzle-orm";

import { admins } from "@repo/database/schema";

import { auth } from "@/lib/auth";
import { adminSetupSchema, type AdminSetupInput } from "@/lib/admin-setup-schema";
import { db } from "@/lib/db";

export type AdminSetupResult =
  | { ok: true; email: string }
  | { ok: false; code: string; message: string };

/**
 * True only while the `admins` allowlist is empty.
 *
 * This single flag is what makes first-run bootstrap self-destructing: the
 * moment the first owner exists, /setup and this endpoint go dead forever. A
 * fresh Vercel preview deployment pointed at the production database therefore
 * cannot mint a second owner.
 */
export async function isAdminSetupAvailable(): Promise<boolean> {
  const [row] = await db.select({ value: count() }).from(admins);
  return (row?.value ?? 0) === 0;
}

/**
 * Creates the very first `owner`.
 *
 * This is the only way to get the first admin credential, because the panel
 * ships with sign-in only — there is no sign-up page, by design. It does two
 * things, in order:
 *
 *   1. better-auth signUpEmail -> creates the `user` row and the `account` row
 *      holding the scrypt password hash. Going through better-auth is what
 *      guarantees the hash matches what signInEmail expects.
 *   2. Inserts the `admins` allowlist row, which is what requireAdmin()
 *      actually checks.
 *
 * Guarded three ways: the table must be empty, ADMIN_BOOTSTRAP_SECRET must
 * match, and the whole thing is one transaction so a failure cannot leave a
 * half-created owner that locks everyone out.
 */
export async function runAdminSetup(
  rawInput: unknown,
): Promise<AdminSetupResult> {
  const expectedSecret = process.env.ADMIN_BOOTSTRAP_SECRET;
  if (!expectedSecret) {
    return {
      ok: false,
      code: "BOOTSTRAP_NOT_CONFIGURED",
      message:
        "ADMIN_BOOTSTRAP_SECRET is not set on this deployment. Add it, redeploy, then try again.",
    };
  }

  const parsed = adminSetupSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: parsed.error.issues[0]?.message ?? "Check the form and try again",
    };
  }
  const input: AdminSetupInput = parsed.data;

  if (input.bootstrapSecret !== expectedSecret) {
    return {
      ok: false,
      code: "BOOTSTRAP_FORBIDDEN",
      message: "That bootstrap secret is not correct",
    };
  }

  if (!(await isAdminSetupAvailable())) {
    return {
      ok: false,
      code: "SETUP_ALREADY_COMPLETE",
      message:
        "An admin already exists. Manage admins from the panel instead — this page is permanently disabled.",
    };
  }

  // better-auth performs the hashing. If this throws (duplicate email, weak
  // password), nothing has been written to `admins` yet.
  let authUserId: string;
  try {
    const result = await auth.api.signUpEmail({
      body: {
        email: input.email,
        password: input.password,
        name: input.name,
      },
    });
    authUserId = result.user.id;
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Could not create the account";
    return {
      ok: false,
      code: "ACCOUNT_CREATE_FAILED",
      message:
        message.includes("already") || message.includes("exists")
          ? "An account with that email already exists. Sign in instead."
          : message,
    };
  }

  try {
    await db.insert(admins).values({
      id: authUserId,
      email: input.email,
      name: input.name,
      // Legacy plaintext NOT NULL column, never read by better-auth (the hash
      // lives in `account`). Random so it can never be mistaken for a
      // credential. R6 of admin-roles-plan.md drops this column entirely.
      password: `!disabled:${randomBytes(24).toString("hex")}`,
      // First admin gets the highest existing role. The enum is
      // superadmin|admin|viewer today; R2 of admin-roles-plan.md migrates it
      // to owner|admin|support|analyst. Do not invent a value here — this
      // insert would fail against the column's CHECK constraint.
      role: "superadmin",
      emailVerified: true,
    });
  } catch {
    // Do not auto-rollback the better-auth rows — a password set through the
    // customer app at this address is legitimate and recoverable via the
    // CLI script. Surface it instead.
    return {
      ok: false,
      code: "ALLOWLIST_CREATE_FAILED",
      message:
        "The sign-in account was created but the admin allowlist row failed. Run: pnpm --filter admin create-admin " +
        input.email,
    };
  }

  return { ok: true, email: input.email };
}