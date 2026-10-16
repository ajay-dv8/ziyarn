import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { admins } from "@repo/database/schema";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export type AdminRole = "superadmin" | "admin" | "viewer";

export type AdminIdentity = {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
};

/**
 * Returns the signed-in identity ONLY if it is on the `admins` allowlist.
 *
 * This is the actual admin authorization boundary. The better-auth instance in
 * lib/auth.ts authenticates against the shared customer tables, so a signed-up
 * customer has a perfectly valid session cookie — without this check they could
 * read every user, domain, workspace, conversation, payment and lead on the
 * platform. A session alone is NOT proof of admin access.
 *
 * Returns null for an unauthenticated OR non-allowlisted caller.
 */
export async function getAdminIdentity(): Promise<AdminIdentity | null> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  const email = session?.user?.email;
  if (!email) {
    return null;
  }

  const [admin] = await db
    .select({
      id: admins.id,
      email: admins.email,
      name: admins.name,
      role: admins.role,
    })
    .from(admins)
    .where(eq(admins.email, email.toLowerCase()))
    .limit(1);

  if (!admin) {
    return null;
  }

  return {
    id: admin.id,
    email: admin.email,
    name: admin.name,
    role: admin.role as AdminRole,
  };
}

/**
 * Page guard for every route under /admin. Redirects to the sign-in screen
 * when the caller is not an allowlisted admin. `returnTo` lets the sign-in page
 * send them back where they were headed.
 */
export async function requireAdmin(returnTo?: string): Promise<AdminIdentity> {
  const admin = await getAdminIdentity();
  if (!admin) {
    redirect(
      returnTo ? `/sign-in?returnTo=${encodeURIComponent(returnTo)}` : "/sign-in",
    );
  }
  return admin;
}