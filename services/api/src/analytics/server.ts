import { and, eq, gte, sql } from "drizzle-orm";

import type { Database } from "@repo/database";
import {
  agents,
  bookings,
  campaigns,
  conversations,
  domains,
  leads,
  payments,
  products,
} from "@repo/database/schema";

import type { SessionWithUser } from "@repo/api/domains/server";
import {
  getAnalyticsSchema,
  type DayBucket,
  type DomainAnalytics,
  type GetAnalyticsInput,
  type RevenueByCurrency,
  type TopProduct,
} from "@repo/api/analytics/schemas";

export class AnalyticsServiceError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AnalyticsServiceError";
  }
}

const unauthorized = () =>
  new AnalyticsServiceError(401, "UNAUTHORIZED", "You must be signed in");

const forbidden = () =>
  new AnalyticsServiceError(403, "FORBIDDEN", "You do not own this domain");

const domainNotFound = () =>
  new AnalyticsServiceError(404, "DOMAIN_NOT_FOUND", "Domain not found");

const RANGE_DAYS: Record<"7" | "30" | "90", number> = {
  "7": 7,
  "30": 30,
  "90": 90,
};

const dayKey = (date: Date) => date.toISOString().slice(0, 10);

function buildDayBuckets(from: Date): string[] {
  const buckets: string[] = [];
  const cursor = new Date(from);
  while (dayKey(cursor) <= dayKey(new Date())) {
    buckets.push(dayKey(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return buckets;
}

function mergeCounts(
  buckets: string[],
  rows: { day: string; count: number }[],
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const key of buckets) map[key] = 0;
  for (const row of rows) map[row.day] = row.count;
  return map;
}

/**
 * Owner-scoped analytics: aggregate conversations / leads / bookings /
 * payments (per domain, over a range) plus owner-wide campaign summaries.
 */
export function createAnalyticsService(deps: {
  db: Database;
  getSession: (headers: Headers) => Promise<SessionWithUser>;
}) {
  const { db, getSession } = deps;

  const requireOwnedDomain = async (
    domainId: string,
    headers: Headers,
  ): Promise<NonNullable<SessionWithUser>> => {
    const session = await getSession(headers);
    if (!session) throw unauthorized();

    const [domain] = await db
      .select({ id: domains.id, ownerId: domains.ownerId })
      .from(domains)
      .where(eq(domains.id, domainId))
      .limit(1);

    if (!domain) throw domainNotFound();
    if (domain.ownerId !== session.user.id) throw forbidden();

    return session;
  };

  return {
    /** Full analytics snapshot for one owned domain over the given range. */
    getAnalytics: async (input: GetAnalyticsInput, headers: Headers): Promise<DomainAnalytics> => {
      const body = getAnalyticsSchema.parse(input);
      const session = await requireOwnedDomain(body.domainId, headers);

      const days = RANGE_DAYS[body.range];
      const from = new Date(Date.now() - days * 86_400_000);
      const buckets = buildDayBuckets(from);

      const conversationRows = await db
        .select({
          day: sql<string>`to_char(${conversations.createdAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`,
          count: sql<number>`count(*)::int`,
        })
        .from(conversations)
        .innerJoin(agents, eq(conversations.agentId, agents.id))
        .where(
          and(
            eq(agents.domainId, body.domainId),
            gte(conversations.createdAt, from),
          ),
        )
        .groupBy(sql`1`);

      const leadRows = await db
        .select({
          day: sql<string>`to_char(${leads.createdAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`,
          count: sql<number>`count(*)::int`,
        })
        .from(leads)
        .innerJoin(conversations, eq(leads.conversationId, conversations.id))
        .innerJoin(agents, eq(conversations.agentId, agents.id))
        .where(
          and(
            eq(agents.domainId, body.domainId),
            gte(leads.createdAt, from),
          ),
        )
        .groupBy(sql`1`);

      const bookingRows = await db
        .select({
          day: sql<string>`to_char(${bookings.createdAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`,
          count: sql<number>`count(*)::int`,
        })
        .from(bookings)
        .where(
          and(eq(bookings.domainId, body.domainId), gte(bookings.createdAt, from)),
        )
        .groupBy(sql`1`);

      const paymentRows = await db
        .select({
          day: sql<string>`to_char(${payments.createdAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`,
          currency: payments.currency,
          count: sql<number>`count(*)::int`,
          paidCount: sql<number>`count(*) FILTER (WHERE ${payments.status} = 'paid')::int`,
          revenueMinor: sql<number>`coalesce(sum(${payments.amountMinor}) FILTER (WHERE ${payments.status} = 'paid'), 0)::int`,
        })
        .from(payments)
        .where(
          and(eq(payments.domainId, body.domainId), gte(payments.createdAt, from)),
        )
        .groupBy(sql`1`, payments.currency);

      const conversationsByDay = mergeCounts(
        buckets,
        conversationRows.map((row) => ({ day: row.day, count: row.count })),
      );
      const leadsByDay = mergeCounts(
        buckets,
        leadRows.map((row) => ({ day: row.day, count: row.count })),
      );
      const bookingsByDay = mergeCounts(
        buckets,
        bookingRows.map((row) => ({ day: row.day, count: row.count })),
      );

      const revenueByDay: Record<string, RevenueByCurrency[]> = {};
      const paymentsByDay: Record<string, number> = {};
      const paidByDay: Record<string, number> = {};
      for (const key of buckets) {
        revenueByDay[key] = [];
        paymentsByDay[key] = 0;
        paidByDay[key] = 0;
      }
      for (const row of paymentRows) {
        paymentsByDay[row.day] = (paymentsByDay[row.day] ?? 0) + row.count;
        paidByDay[row.day] = (paidByDay[row.day] ?? 0) + row.paidCount;
        revenueByDay[row.day]?.push({
          currency: row.currency,
          minor: row.revenueMinor,
        });
      }

      const series: DayBucket[] = buckets.map((date) => {
        const revenue = revenueByDay[date] ?? [];
        const primary = [...revenue].sort((a, b) => b.minor - a.minor)[0];
        return {
          date,
          conversations: conversationsByDay[date] ?? 0,
          leads: leadsByDay[date] ?? 0,
          bookings: bookingsByDay[date] ?? 0,
          payments: paymentsByDay[date] ?? 0,
          revenueMinor: primary?.minor ?? 0,
          currency: primary?.currency ?? "usd",
        };
      });

      const [bookingStatuses] = await db
        .select({
          total: sql<number>`count(*)::int`,
          confirmed: sql<number>`count(*) FILTER (WHERE ${bookings.status} = 'confirmed')::int`,
        })
        .from(bookings)
        .where(
          and(eq(bookings.domainId, body.domainId), gte(bookings.createdAt, from)),
        );

      const bookingsByStatusRows = await db
        .select({
          label: bookings.status,
          count: sql<number>`count(*)::int`,
        })
        .from(bookings)
        .where(
          and(eq(bookings.domainId, body.domainId), gte(bookings.createdAt, from)),
        )
        .groupBy(bookings.status)
        .orderBy(sql`count(*) DESC`);

      const conversationStatusRows = await db
        .select({
          label: conversations.status,
          count: sql<number>`count(*)::int`,
        })
        .from(conversations)
        .innerJoin(agents, eq(conversations.agentId, agents.id))
        .where(
          and(
            eq(agents.domainId, body.domainId),
            gte(conversations.createdAt, from),
          ),
        )
        .groupBy(conversations.status)
        .orderBy(sql`count(*) DESC`);

      const paymentStatusRows = await db
        .select({
          label: payments.status,
          count: sql<number>`count(*)::int`,
          revenueMinor: sql<number>`coalesce(sum(${payments.amountMinor}) FILTER (WHERE ${payments.status} = 'paid'), 0)::int`,
          currency: payments.currency,
        })
        .from(payments)
        .where(
          and(eq(payments.domainId, body.domainId), gte(payments.createdAt, from)),
        )
        .groupBy(payments.status, payments.currency)
        .orderBy(sql`count(*) DESC`);

      const topProductRows = await db
        .select({
          productId: payments.productId,
          name: products.name,
          paidCount: sql<number>`count(*)::int`,
          currency: payments.currency,
          revenueMinor: sql<number>`coalesce(sum(${payments.amountMinor}) FILTER (WHERE ${payments.status} = 'paid'), 0)::int`,
        })
        .from(payments)
        .innerJoin(products, eq(payments.productId, products.id))
        .where(
          and(
            eq(payments.domainId, body.domainId),
            gte(payments.createdAt, from),
            eq(payments.status, "paid"),
          ),
        )
        .groupBy(payments.productId, products.name, payments.currency)
        .orderBy(sql`count(*) DESC`)
        .limit(5);

      const topProducts: TopProduct[] = Object.values(
        topProductRows.reduce<Record<string, TopProduct>>((acc, row) => {
          const key = row.productId ?? row.name;
          const entry = acc[key] ?? {
            productId: row.productId ?? "",
            name: row.name ?? "Unknown product",
            paidCount: 0,
            revenueByCurrency: [],
          };
          entry.paidCount += row.paidCount;
          entry.revenueByCurrency.push({
            currency: row.currency,
            minor: row.revenueMinor,
          });
          acc[key] = entry;
          return acc;
        }, {}),
      );

      const campaignRows = await db
        .select({
          id: campaigns.id,
          name: campaigns.name,
          status: campaigns.status,
          sent: campaigns.sentCount,
          delivered: campaigns.deliveredCount,
          failed: campaigns.failedCount,
          unsubscribed: campaigns.unsubscribedCount,
          createdAt: campaigns.createdAt,
        })
        .from(campaigns)
        .where(
          and(
            eq(campaigns.ownerId, session.user.id),
            gte(campaigns.createdAt, from),
          ),
        )
        .orderBy(sql`${campaigns.createdAt} DESC`)
        .limit(10);

      const totalRevenueByCurrency: Record<string, number> = {};
      for (const row of paymentStatusRows) {
        if (row.label === "paid") {
          totalRevenueByCurrency[row.currency] =
            (totalRevenueByCurrency[row.currency] ?? 0) + row.revenueMinor;
        }
      }

      const revenueByCurrency: RevenueByCurrency[] = Object.entries(
        totalRevenueByCurrency,
      )
        .map(([currency, minor]) => ({ currency, minor }))
        .sort((a, b) => b.minor - a.minor);

      const totals = {
        conversations: conversationRows.reduce((sum, row) => sum + row.count, 0),
        leads: leadRows.reduce((sum, row) => sum + row.count, 0),
        bookings: bookingStatuses?.total ?? 0,
        confirmedBookings: bookingStatuses?.confirmed ?? 0,
        payments: paymentRows.reduce((sum, row) => sum + row.count, 0),
        paidPayments: paymentRows.reduce((sum, row) => sum + row.paidCount, 0),
        revenueByCurrency,
      };

      return {
        range: body.range,
        from: dayKey(from),
        to: dayKey(new Date()),
        totals,
        series,
        conversationsByStatus: conversationStatusRows.map((row) => ({
          label: row.label,
          count: row.count,
        })),
        bookingsByStatus: bookingsByStatusRows.map((row) => ({
          label: row.label,
          count: row.count,
        })),
        paymentsByStatus: paymentStatusRows
          .map((row) => ({ label: row.label, count: row.count }))
          .sort((a, b) => b.count - a.count),
        topProducts,
        campaigns: campaignRows.map((row) => ({
          id: row.id,
          name: row.name,
          status: row.status,
          sent: row.sent,
          delivered: row.delivered,
          failed: row.failed,
          unsubscribed: row.unsubscribed,
          createdAt: row.createdAt.toISOString(),
        })),
      };
    },
  };
}