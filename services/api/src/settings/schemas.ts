import { z } from "zod";

import { CURRENCY_CODES } from "@repo/money";

export const updateProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(100, "Name must be at most 100 characters"),
});

export const updateDefaultCurrencySchema = z.object({
  defaultCurrency: z.enum(CURRENCY_CODES as unknown as [string, ...string[]]),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be at most 128 characters"),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdateDefaultCurrencyInput = z.infer<typeof updateDefaultCurrencySchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
