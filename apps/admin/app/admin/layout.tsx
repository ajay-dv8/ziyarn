import Link from "next/link";
import React from "react";

import { requireAdmin } from "@/lib/admin-auth";

const NAV_ITEMS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/domains", label: "Domains" },
  { href: "/admin/workspaces", label: "Workspaces" },
  { href: "/admin/conversations", label: "Conversations" },
  { href: "/admin/revenue", label: "Revenue" },
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
  const admin = await requireAdmin("/admin");

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
          {/* Sign-out is a better-auth server endpoint, not a page — it must be
              a full navigation, so <a> is correct here despite the lint rule. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/api/auth/signout"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-red-400 hover:bg-zinc-800"
          >
            Sign out
          </a>
        </div>
      </aside>
      <main className="ml-64 flex-1 p-8">{children}</main>
    </div>
  );
}