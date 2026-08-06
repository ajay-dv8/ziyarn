import { z } from "zod";

export const usagePeriodSchema = z.object({
  /** Local period in YYYY-MM. Defaults to the current month. */
  period: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "Period must look like 2026-06")
    .optional(),
});

export type UsagePeriodInput = z.infer<typeof usagePeriodSchema>;

export type UsageSummary = {
  period: string;
  plan: string;
  /** Conversations created by the owner's widgets this period. */
  conversations: number;
  /** AI-support messages stored this period (visitor + assistant). */
  messages: number;
  /** Marketing emails sent this period. */
  emails: number;
  /** Plan limits the owner is measured against. */
  limits: {
    maxDomains: number;
    creditsPerMonth: number;
    conversationsPerDay: number;
    emailsPerMonth: number;
    maxProductsPerDomain: number;
  };
};