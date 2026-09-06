import { notFound } from "next/navigation";
import { getDomainDetail } from "@/services/admin-service";
import Link from "next/link";
import React from "react";

function formatCurrency(amountMinor: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(amountMinor / 100);
}

export default async function DomainDetailPage({
  params,
}: {
  params: Promise<{ domainId: string }>;
}): Promise<React.ReactNode> {
  const { domainId } = await params;
  const domain = await getDomainDetail(domainId);

  if (!domain) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin/domains" className="text-sm text-zinc-400 hover:text-white">
          ← Back to domains
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{domain.name}</h1>
        <p className="text-sm text-zinc-400">{domain.slug}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-sm text-zinc-400">Owner</p>
          <p className="mt-1 text-lg font-medium">{domain.ownerName}</p>
          <p className="text-xs text-zinc-500">{domain.ownerEmail}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-sm text-zinc-400">Plan</p>
          <p className="mt-1 text-lg font-medium capitalize">{domain.plan}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-sm text-zinc-400">Business Type</p>
          <p className="mt-1 text-lg font-medium">{domain.businessType ?? "Generic"}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-sm text-zinc-400">Created</p>
          <p className="mt-1 text-lg font-medium">
            {new Date(domain.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-sm text-zinc-400">Conversations</p>
          <p className="mt-1 text-2xl font-semibold">{domain.conversationCount}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-sm text-zinc-400">Agents</p>
          <p className="mt-1 text-2xl font-semibold">{domain.agents.length}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-sm text-zinc-400">Products</p>
          <p className="mt-1 text-2xl font-semibold">{domain.productCount}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-sm text-zinc-400">Customers</p>
          <p className="mt-1 text-2xl font-semibold">{domain.customerCount}</p>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="mb-4 text-lg font-medium">Revenue</h2>
        <p className="text-3xl font-semibold">{formatCurrency(domain.totalRevenue)}</p>
        <p className="text-sm text-zinc-400">
          {domain.bookingCount} bookings
        </p>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="mb-4 text-lg font-medium">Agents</h2>
        {domain.agents.length === 0 ? (
          <p className="text-sm text-zinc-500">No agents configured</p>
        ) : (
          <div className="space-y-2">
            {domain.agents.map((agent) => (
              <div
                key={agent.id}
                className="flex items-center justify-between rounded-lg border border-zinc-800 p-3"
              >
                <div>
                  <p className="font-medium">{agent.name}</p>
                  {agent.description && (
                    <p className="text-sm text-zinc-400">{agent.description}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  {agent.tools && agent.tools.length > 0 && (
                    <span className="rounded-full bg-zinc-800 px-2 py-1 text-xs text-zinc-300">
                      {agent.tools.length} tools
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
