import { z } from "zod";

import { checkoutPlanSchema } from "@repo/api/billing/schemas";

export const paystackInitializeSchema = z.object({
  plan: checkoutPlanSchema,
});

export const paystackVerifySchema = z.object({
  reference: z.string().min(1).max(100),
});

export const paystackCancelSchema = z.object({});

export const paystackReconcileSchema = z.object({
  /**
   * The owner's email. Only used to locate the Paystack customer when a
   * transaction record is missing one; authorization is always the
   * server-owned `metadata.ownerId` stamped at initialize time.
   */
  email: z.string().email().max(200),
});

export type PaystackInitializeInput = z.infer<typeof paystackInitializeSchema>;
export type PaystackVerifyInput = z.infer<typeof paystackVerifySchema>;
export type PaystackReconcileInput = z.infer<typeof paystackReconcileSchema>;
