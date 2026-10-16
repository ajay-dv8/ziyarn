import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import type { Auth, BetterAuthOptions } from "better-auth";
import { betterAuth } from "better-auth/minimal";
import { nextCookies } from "better-auth/next-js";

import { db } from "@/lib/db";

/**
 * Admin auth is a SEPARATE better-auth instance from the customer app.
 *
 * Isolation matters in three places:
 *
 *  1. Secret    — ADMIN_BETTER_AUTH_SECRET, never BETTER_AUTH_SECRET. Sharing a
 *                 secret would let an admin session token be replayed against
 *                 the customer app and vice versa.
 *  2. Cookie    — cookies do NOT isolate by port, so localhost:3000 and
 *                 localhost:3001 share a cookie jar. A distinct cookiePrefix
 *                 stops a customer session from auto-authenticating an admin.
 *  3. Database  — this instance resolves to the standard user/session/account
 *                 tables, i.e. the CUSTOMER identity tables. That is why every
 *                 admin route must additionally pass through requireAdmin()
 *                 (lib/admin-auth.ts), which checks the `admins` allowlist.
 *                 betterAuth() alone is NOT an admin authorization check.
 *
 * Trusted origins come from the admin URL so the panel cannot be driven from a
 * hostile origin.
 */
const adminUrl = process.env.ADMIN_BETTER_AUTH_URL ?? "http://localhost:3001";

// Explicit annotation on the config as well as the instance: the adapter type
// is not portable across the pnpm store, so TS2742 needs both spelled out
// (same class of fix as apps/web/lib/auth.ts).
const authConfig: BetterAuthOptions = {
  baseURL: adminUrl,
  secret: process.env.ADMIN_BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    minPasswordLength: 12,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  // Distinct prefix so admin and customer cookies never collide.
  advanced: {
    cookiePrefix: "ziyarn-admin",
  },
  trustedOrigins: [adminUrl],
  plugins: [nextCookies()],
};

// Explicit annotation: without it TS2742 cannot name the inferred adapter type
// and the declaration is not portable (same fix as apps/web/lib/auth.ts).
export const auth: Auth<typeof authConfig> = betterAuth(authConfig);

export type AdminAuthSession = typeof auth.$Infer.Session;