import { listUsers } from "@/services/admin-service";
import Link from "next/link";
import React from "react";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string }>;
}): Promise<React.ReactNode> {
  const params = await searchParams;
  const page = Number(params.page) || 1;
  const search = params.search || "";

  const { users, total, pageSize } = await listUsers({ page, search });
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Users</h1>
        <p className="text-sm text-zinc-400">{total} total users</p>
      </div>

      <form className="flex gap-2">
        <input
          type="search"
          name="search"
          defaultValue={search}
          placeholder="Search by email..."
          className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-blue-500 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-lg bg-zinc-800 px-4 py-2 text-sm text-white hover:bg-zinc-700"
        >
          Search
        </button>
      </form>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-left text-zinc-400">
              <th className="p-4">Name</th>
              <th className="p-4">Email</th>
              <th className="p-4">Domains</th>
              <th className="p-4">Plan</th>
              <th className="p-4">Joined</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-zinc-800 last:border-0">
                <td className="p-4">
                  <Link
                    href={`/admin/users/${user.id}`}
                    className="text-blue-400 hover:underline"
                  >
                    {user.name}
                  </Link>
                </td>
                <td className="p-4 text-zinc-300">{user.email}</td>
                <td className="p-4 text-zinc-300">{user.domainCount}</td>
                <td className="p-4">
                  <span className="rounded-full bg-zinc-800 px-2 py-1 text-xs capitalize text-zinc-300">
                    {user.plan}
                  </span>
                </td>
                <td className="p-4 text-zinc-400">
                  {new Date(user.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="p-4 text-center text-zinc-500">
                  No users found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <a
              key={p}
              href={`/admin/users?page=${p}${search ? `&search=${search}` : ""}`}
              className={`rounded-lg px-3 py-1 text-sm ${
                p === page
                  ? "bg-blue-600 text-white"
                  : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
              }`}
            >
              {p}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
