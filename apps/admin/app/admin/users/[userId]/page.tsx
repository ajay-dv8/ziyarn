import { notFound } from "next/navigation";
import { getUserDetail } from "@/services/admin-service";
import Link from "next/link";
import React from "react";

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}): Promise<React.ReactNode> {
  const { userId } = await params;
  const userDetail = await getUserDetail(userId);

  if (!userDetail) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin/users" className="text-sm text-zinc-400 hover:text-white">
          ← Back to users
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{userDetail.name}</h1>
        <p className="text-sm text-zinc-400">{userDetail.email}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-sm text-zinc-400">Email Verified</p>
          <p className="mt-1 text-lg font-medium">
            {userDetail.emailVerified ? "Yes" : "No"}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-sm text-zinc-400">Domains</p>
          <p className="mt-1 text-lg font-medium">{userDetail.domains.length}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-sm text-zinc-400">Workspaces</p>
          <p className="mt-1 text-lg font-medium">{userDetail.workspaces.length}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-sm text-zinc-400">Joined</p>
          <p className="mt-1 text-lg font-medium">
            {new Date(userDetail.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="mb-4 text-lg font-medium">Domains</h2>
        {userDetail.domains.length === 0 ? (
          <p className="text-sm text-zinc-500">No domains</p>
        ) : (
          <div className="space-y-2">
            {userDetail.domains.map((domain) => (
              <div
                key={domain.id}
                className="flex items-center justify-between rounded-lg border border-zinc-800 p-3"
              >
                <div>
                  <p className="font-medium">{domain.name}</p>
                  <p className="text-sm text-zinc-400">{domain.slug}</p>
                </div>
                <span className="rounded-full bg-zinc-800 px-2 py-1 text-xs capitalize text-zinc-300">
                  {domain.plan}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="mb-4 text-lg font-medium">Subscriptions</h2>
        {userDetail.subscriptions.length === 0 ? (
          <p className="text-sm text-zinc-500">No subscriptions</p>
        ) : (
          <div className="space-y-2">
            {userDetail.subscriptions.map((sub) => (
              <div
                key={sub.id}
                className="flex items-center justify-between rounded-lg border border-zinc-800 p-3"
              >
                <div>
                  <p className="font-medium capitalize">{sub.plan}</p>
                  <p className="text-sm text-zinc-400">{sub.status}</p>
                </div>
                <span className="text-sm text-zinc-400">
                  {sub.currentPeriodEnd
                    ? `Renews ${new Date(sub.currentPeriodEnd).toLocaleDateString()}`
                    : "No renewal date"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
