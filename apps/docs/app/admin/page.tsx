import { getPlatformStats, getRevenueStats } from "@/services/admin-service";

function formatCurrency(amountMinor: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(amountMinor / 100);
}

export default async function AdminOverviewPage() {
  const stats = await getPlatformStats();
  const revenue = await getRevenueStats({ days: 30 });

  const statCards = [
    { label: "Users", value: stats.users.toLocaleString(), color: "bg-blue-500/10 text-blue-500" },
    { label: "Domains", value: stats.domains.toLocaleString(), color: "bg-purple-500/10 text-purple-500" },
    { label: "Conversations", value: stats.conversations.toLocaleString(), color: "bg-green-500/10 text-green-500" },
    { label: "Active Subscriptions", value: stats.activeSubscriptions.toLocaleString(), color: "bg-amber-500/10 text-amber-500" },
    { label: "Total Revenue", value: formatCurrency(stats.totalRevenue), color: "bg-emerald-500/10 text-emerald-500" },
    { label: "Total Payments", value: stats.payments.toLocaleString(), color: "bg-cyan-500/10 text-cyan-500" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Platform Overview</h1>
        <p className="text-sm text-zinc-400">Monitor all activity across Ziyarn</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {statCards.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-zinc-800 bg-zinc-900 p-6"
          >
            <p className="text-sm text-zinc-400">{stat.label}</p>
            <p className="mt-2 text-3xl font-semibold">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="mb-4 text-lg font-medium">Revenue (30 days)</h2>
          <div className="space-y-2">
            {revenue.revenueByDay.length === 0 ? (
              <p className="text-sm text-zinc-500">No revenue data yet</p>
            ) : (
              revenue.revenueByDay.map((day) => (
                <div key={day.date} className="flex items-center justify-between text-sm">
                  <span className="text-zinc-400">{day.date}</span>
                  <span className="font-medium">{formatCurrency(day.total)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="mb-4 text-lg font-medium">Revenue by Plan</h2>
          <div className="space-y-2">
            {revenue.revenueByPlan.length === 0 ? (
              <p className="text-sm text-zinc-500">No revenue data yet</p>
            ) : (
              revenue.revenueByPlan.map((plan) => (
                <div key={plan.plan} className="flex items-center justify-between text-sm">
                  <span className="text-zinc-400 capitalize">{plan.plan}</span>
                  <span className="font-medium">{formatCurrency(plan.total)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
