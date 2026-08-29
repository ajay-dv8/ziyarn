import { z } from "zod";

import { CURRENCY_CODES, DEFAULT_CURRENCY } from "@repo/money";

export const portalTokenSchema = z.object({
  type: z.enum(["booking", "payment"]),
  id: z.string().uuid(),
  domainId: z.string().uuid(),
  exp: z.number().int().positive(),
});

export const createBookingSchema = z.object({
  domainId: z.string().uuid(),
  conversationId: z.string().uuid().nullish(),
  name: z.string().trim().max(200).optional(),
  email: z.string().trim().email().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "time must be HH:MM in 24h format"),
  duration: z.number().int().min(15).max(480).optional(),
  timezone: z.string().trim().max(50).optional(),
  topic: z.string().trim().max(500).optional(),
});

export const updateBookingStatusSchema = z.object({
  status: z.enum(["pending", "confirmed", "cancelled"]),
});

export const listBookingsSchema = z.object({
  domainId: z.string().uuid(),
  status: z.enum(["pending", "confirmed", "cancelled"]).optional(),
  limit: z.number().int().min(1).max(200).optional(),
  offset: z.number().int().min(0).optional(),
});

export const bookingSettingsSchema = z.object({
  availableDays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  availableStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "time must be HH:MM"),
  availableEnd: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "time must be HH:MM"),
  slotDuration: z.number().int().min(15).max(480),
  minNoticeHours: z.number().int().min(0).max(168),
  maxAdvanceDays: z.number().int().min(1).max(90),
});

export const createPaymentRequestSchema = z.object({
  domainId: z.string().uuid(),
  conversationId: z.string().uuid().nullish(),
  bookingId: z.string().uuid().nullish(),
  productId: z.string().uuid().nullish(),
  email: z.string().trim().email().optional(),
  description: z.string().trim().max(500).optional(),
  amountMinor: z.number().int().positive().max(100_000_000),
  currency: z
    .string()
    .trim()
    .toLowerCase()
    .refine(
      (value) => (CURRENCY_CODES as readonly string[]).includes(value),
      { message: "Unsupported currency code" },
    )
    .default(DEFAULT_CURRENCY),
});

export const confirmBookingSchema = z.object({
  token: z.string().min(10).max(1000),
});

export type PortalTokenPayload = z.infer<typeof portalTokenSchema>;
export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type UpdateBookingStatusInput = z.infer<typeof updateBookingStatusSchema>;
export type BookingSettingsInput = z.infer<typeof bookingSettingsSchema>;
export type CreatePaymentRequestInput = z.infer<
  typeof createPaymentRequestSchema
>;
