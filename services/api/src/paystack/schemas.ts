import { z } from "zod";

import { checkoutPlanSchema } from "@repo/api/billing/schemas";

export const paystackInitializeSchema = z.object({
  plan: checkoutPlanSchema,
});

export const paystackVerifySchema = z.object({
  reference: z.string().min(1).max(100),
});

export const paystackCancelSchema = z.object({});

export type PaystackInitializeInput = z.infer<typeof paystackInitializeSchema>;
export type PaystackVerifyInput = z.infer<typeof paystackVerifySchema>;
