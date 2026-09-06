import { getRevenueStats, listDomains } from "@/services/admin-service";
import React from "react";

function formatCurrency(amountMinor: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(amountMinor / 100);
}

export default async function RevenuePage(): Promise<React.ReactNode> {
  const revenue = await getRevenueStats({ days: 30 });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Revenue</h1>
        <p className="text-sm text-zinc-400">Platform-wide revenue analytics</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <p className="text-sm text-zinc-400">Total Revenue</p>
          <p className="mt-2 text-3xl font-semibold text-emerald-400">
            {formatCurrency(revenue.totalRevenue)}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <p className="text-sm text-zinc-400">Revenue (30d)</p>
          <p className="mt-2 text-3xl font-semibold">
            {formatCurrency(
              revenue.revenueByDay.reduce((sum, day) => sum + day.total, 0),
            )}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <p className="text-sm text-zinc-400">Active Plans</p>
          <p className="mt-2 text-3xl font-semibold">
            {revenue.revenueByPlan.length}
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="mb-4 text-lg font-medium">Daily Revenue (30d)</h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {revenue.revenueByDay.length === 0 ? (
              <p className="text-sm text-zinc-500">No revenue data yet</p>
            ) : (
              revenue.revenueByDay.map((day) => (
                <div key={day.date} className="flex items-center justify-between text-sm py-1">
                  <span className="text-zinc-400">{day.date}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-zinc-500">{day.count} payments</span>
                    <span className="font-medium text-emerald-400">
                      {formatCurrency(day.total)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="mb-4 text-lg font-medium">Revenue by Plan</h2>
          <div className="space-y-3">
            {revenue.revenueByPlan.length === 0 ? (
              <p className="text-sm text-zinc-500">No revenue data yet</p>
            ) : (
              revenue.revenueByPlan
                .sort((a, b) => b.total - a.total)
                .map((plan) => (
                  <div
                    key={plan.plan}
                    className="flex items-center justify-between rounded-lg border border-zinc-800 p-3"
                  >
                    <div>
                      <p className="font-medium capitalize">{plan.plan}</p>
                      <p className="text-sm text-zinc-400">
                        {plan.count} payment{plan.count !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <p className="text-lg font-semibold text-emerald-400">
                      {formatCurrency(plan.total)}
                    </p>
                  </div>
                ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
