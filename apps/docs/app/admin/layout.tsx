import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import React from "react";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.ReactNode> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in");
  }

  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 w-64 border-r border-zinc-800 bg-zinc-900">
        <div className="flex h-14 items-center border-b border-zinc-800 px-4">
          <h1 className="text-lg font-semibold">Ziyarn Admin</h1>
        </div>
        <nav className="space-y-1 p-2">
          <a
            href="/admin"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white"
          >
            Overview
          </a>
          <a
            href="/admin/users"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white"
          >
            Users
          </a>
          <a
            href="/admin/domains"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white"
          >
            Domains
          </a>
          <a
            href="/admin/workspaces"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white"
          >
            Workspaces
          </a>
          <a
            href="/admin/conversations"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white"
          >
            Conversations
          </a>
          <a
            href="/admin/revenue"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white"
          >
            Revenue
          </a>
        </nav>
        <div className="absolute bottom-0 left-0 right-0 border-t border-zinc-800 p-2">
          <div className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-400">
            {session.user.email}
          </div>
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
