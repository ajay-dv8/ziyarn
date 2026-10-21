import Link from "next/link";
import React from "react";

import SignOutButton from "@/components/sign-out-button";
import { ADMIN_ROUTES } from "@/constants/routes";
import { requireAdmin } from "@/lib/admin-auth";

// Every page here is session-guarded. Never prerender it at build time: that
// would both bake an unauthenticated shell and make `next build` depend on a
// live database.
export const dynamic = "force-dynamic";

const NAV_ITEMS = [
  { href: ADMIN_ROUTES.HOME, label: "Overview" },
  { href: ADMIN_ROUTES.USERS, label: "Users" },
  { href: ADMIN_ROUTES.DOMAINS, label: "Domains" },
  { href: ADMIN_ROUTES.WORKSPACES, label: "Workspaces" },
  { href: ADMIN_ROUTES.CONVERSATIONS, label: "Conversations" },
  { href: ADMIN_ROUTES.REVENUE, label: "Revenue" },
] as const;

const NAV_LINK_CLASS =
  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.ReactNode> {
  // NOTE: a better-auth session is NOT sufficient here. This instance resolves
  // to the shared customer tables, so any signed-up customer has a valid
  // session cookie. requireAdmin() additionally checks the `admins` allowlist.
  const admin = await requireAdmin(ADMIN_ROUTES.HOME);

  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 w-64 border-r border-zinc-800 bg-zinc-900">
        <div className="flex h-14 items-center border-b border-zinc-800 px-4">
          <h1 className="text-lg font-semibold">Ziyarn Admin</h1>
        </div>
        <nav className="space-y-1 p-2">
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} className={NAV_LINK_CLASS}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 border-t border-zinc-800 p-2">
          <div className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-400">
            {admin.name} · {admin.email}
            <span className="ml-auto rounded bg-zinc-800 px-1.5 py-0.5 text-xs uppercase text-zinc-500">
              {admin.role}
            </span>
          </div>
          <SignOutButton />
        </div>
      </aside>
      <main className="ml-64 flex-1 p-8">{children}</main>
    </div>
  );
}