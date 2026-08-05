import { z } from "zod";

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
  topic: z.string().trim().max(500).optional(),
});

export const createPaymentRequestSchema = z.object({
  domainId: z.string().uuid(),
  conversationId: z.string().uuid().nullish(),
  bookingId: z.string().uuid().nullish(),
  email: z.string().trim().email().optional(),
  description: z.string().trim().max(500).optional(),
  amountMinor: z.number().int().positive().max(100_000_000),
  currency: z.string().length(3).toUpperCase(),
});

export const confirmBookingSchema = z.object({
  token: z.string().min(10).max(1000),
});

export type PortalTokenPayload = z.infer<typeof portalTokenSchema>;
export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type CreatePaymentRequestInput = z.infer<
  typeof createPaymentRequestSchema
>;
