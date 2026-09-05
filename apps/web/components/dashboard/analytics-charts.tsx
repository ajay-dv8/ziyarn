import type { DayBucket } from "@repo/api/analytics";

const MAX_BARS = 31;

export function SeriesBars({ series }: { series: DayBucket[] }) {
  if (series.length === 0) {
    return <p className="text-sm text-muted-foreground">No activity in this range yet.</p>;
  }

  const shown = series.slice(-MAX_BARS);
  const maxConversations = Math.max(1, ...shown.map((dayBucket) => dayBucket.conversations));
  const maxLeads = Math.max(1, ...shown.map((dayBucket) => dayBucket.leads));
  const maxBookings = Math.max(1, ...shown.map((dayBucket) => dayBucket.bookings));
  const maxPayments = Math.max(1, ...shown.map((dayBucket) => dayBucket.payments));

  return (
    <div>
      <div className="mb-2 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-primary" /> Conversations
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-blue-400" /> Leads
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-amber-500" /> Bookings
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Payments
        </span>
      </div>
      <div className="flex items-end gap-1">
        {shown.map((point) => (
          <div
            key={point.date}
            className="group flex flex-1 flex-col items-center gap-0.5"
            title={`${point.date} — ${point.conversations} conversations, ${point.leads} leads, ${point.bookings} bookings, ${point.payments} payments`}
          >
            <div className="flex h-36 w-full items-end justify-center gap-px">
              <div
                className="w-1/4 rounded-t-sm bg-primary/80 transition-colors group-hover:bg-primary"
                style={{ height: `${Math.max(4, (point.conversations / maxConversations) * 100)}%` }}
              />
              <div
                className="w-1/4 rounded-t-sm bg-blue-400/80 transition-colors group-hover:bg-blue-400"
                style={{ height: `${Math.max(4, (point.leads / maxLeads) * 100)}%` }}
              />
              <div
                className="w-1/4 rounded-t-sm bg-amber-500/80 transition-colors group-hover:bg-amber-500"
                style={{ height: `${Math.max(4, (point.bookings / maxBookings) * 100)}%` }}
              />
              <div
                className="w-1/4 rounded-t-sm bg-emerald-500/80 transition-colors group-hover:bg-emerald-500"
                style={{ height: `${Math.max(4, (point.payments / maxPayments) * 100)}%` }}
              />
            </div>
            <span className="text-[10px] leading-none text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
              {point.date.slice(5)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StatusBars({
  rows,
  color,
}: {
  rows: { label: string; count: number }[];
  color: string;
}) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Nothing yet.</p>;
  }
  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.label}>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="capitalize text-muted-foreground">{row.label}</span>
            <span className="font-medium">{row.count}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full ${color}`}
              style={{ width: `${(row.count / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
