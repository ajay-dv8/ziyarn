import { z } from "zod";

export const checkoutPlanSchema = z.enum(["standard", "pro", "ultimate"]);

export const billingPlanSchema = z.enum([
  "free",
  "standard",
  "pro",
  "ultimate",
]);

export type CheckoutPlan = z.infer<typeof checkoutPlanSchema>;
export type BillingPlan = z.infer<typeof billingPlanSchema>;
