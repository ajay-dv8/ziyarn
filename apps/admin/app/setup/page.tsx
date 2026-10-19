import type { Metadata } from "next";
import React from "react";

import { ADMIN_ROUTES } from "@/constants/routes";
import { isAdminSetupAvailable } from "@/lib/admin-setup";

import SetupForm from "./setup-form";

export const metadata: Metadata = {
  title: "Set up admin",
};

export const dynamic = "force-dynamic";

/**
 * First-run bootstrap.
 *
 * Self-destructing: renders only while the `admins` table is empty. Once the
 * first owner exists this route returns 410 for the lifetime of the database,
 * so a fresh Vercel preview pointed at production cannot mint a second owner.
 */
export default async function SetupPage(): Promise<React.ReactNode> {
  if (!(await isAdminSetupAvailable())) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
        <div className="w-full max-w-sm space-y-4 rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center">
          <h1 className="text-xl font-semibold text-white">Setup already done</h1>
          <p className="text-sm text-zinc-400">
            An admin account already exists. This page is permanently disabled.
            Sign in, or ask an existing owner to invite you.
          </p>
          <a
            href={ADMIN_ROUTES.SIGN_IN}
            className="inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Go to sign in
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-sm space-y-6 rounded-xl border border-zinc-800 bg-zinc-900 p-8">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Set up Ziyarn Admin
          </h1>
          <p className="text-sm text-zinc-400">
            No admin accounts exist yet. Create the first one — it becomes the
            platform owner.
          </p>
        </div>
        <SetupForm />
      </div>
    </div>
  );
}