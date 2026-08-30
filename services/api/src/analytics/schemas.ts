import { z } from "zod";

export const analyticsRangeSchema = z.enum(["7", "30", "90"]);

export const getAnalyticsSchema = z.object({
  domainId: z.string().uuid("Invalid domain id"),
  range: analyticsRangeSchema.default("30"),
});

export type AnalyticsRange = z.infer<typeof analyticsRangeSchema>;
export type GetAnalyticsInput = z.infer<typeof getAnalyticsSchema>;

export type DayBucket = {
  date: string;
  conversations: number;
  leads: number;
  bookings: number;
  payments: number;
  revenueMinor: number;
  currency: string;
};

export type CountedValue = {
  label: string;
  count: number;
};

export type RevenueByCurrency = {
  currency: string;
  minor: number;
};

export type TopProduct = {
  productId: string;
  name: string;
  paidCount: number;
  revenueByCurrency: RevenueByCurrency[];
};

export type CampaignSummary = {
  id: string;
  name: string;
  status: string;
  sent: number;
  delivered: number;
  failed: number;
  unsubscribed: number;
  createdAt: string;
};

export type DomainAnalytics = {
  range: AnalyticsRange;
  from: string;
  to: string;
  totals: {
    conversations: number;
    leads: number;
    bookings: number;
    confirmedBookings: number;
    payments: number;
    paidPayments: number;
    revenueByCurrency: RevenueByCurrency[];
  };
  series: DayBucket[];
  conversationsByStatus: CountedValue[];
  bookingsByStatus: CountedValue[];
  paymentsByStatus: CountedValue[];
  topProducts: TopProduct[];
  campaigns: CampaignSummary[];
};