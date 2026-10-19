"use client";

import { useRouter } from "next/navigation";
import React, { useState } from "react";

import { ADMIN_ROUTES } from "@/constants/routes";
import { authClient } from "@/lib/auth-client";

const SIGN_OUT_CLASS =
  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-red-400 hover:bg-zinc-800 disabled:opacity-50";

/**
 * Sign-out, which cannot be a link.
 *
 * The layout used to render `<a href="/api/auth/signout">`, wrong twice over:
 * Better Auth serves `sign-out`, not `signout`, and only on POST. Clicking it
 * rendered a 404 JSON body and left the session untouched.
 *
 * `authClient` knows the correct path and method, so the endpoint is never
 * written out here — see constants/routes.ts.
 */
export default function SignOutButton(): React.ReactNode {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleSignOut() {
    setPending(true);
    await authClient.signOut();
    // The refresh is what makes the current screen stop believing it has an
    // admin: /admin re-runs requireAdmin() on the next render either way.
    router.push(ADMIN_ROUTES.SIGN_IN);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={pending}
      className={SIGN_OUT_CLASS}
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
