import { z } from "zod";

export const emailBlockSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("heading"),
    id: z.string().min(1),
    size: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    text: z.string().max(500),
  }),
  z.object({
    kind: z.literal("paragraph"),
    id: z.string().min(1),
    text: z.string().max(5000),
  }),
  z.object({
    kind: z.literal("button"),
    id: z.string().min(1),
    text: z.string().max(120),
    url: z.string().url().max(2000).or(z.literal("")),
  }),
  z.object({
    kind: z.literal("image"),
    id: z.string().min(1),
    url: z.string().url().max(2000),
    alt: z.string().max(500),
  }),
  z.object({
    kind: z.literal("divider"),
    id: z.string().min(1),
  }),
  z.object({
    kind: z.literal("spacer"),
    id: z.string().min(1),
    height: z.union([z.literal(8), z.literal(16), z.literal(24), z.literal(32)]),
  }),
]);

export const createCampaignSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(120),
    subject: z.string().trim().min(1, "Subject is required").max(200),
    body: z.string().max(20000).optional(),
    blocks: z.array(emailBlockSchema).max(40).optional(),
  })
  .refine((data) => Boolean(data.body) || Boolean(data.blocks), {
    message: "Body is required",
    path: ["body"],
  });

export const scheduleCampaignSchema = z.object({
  scheduledAt: z.string().datetime({ offset: true }),
});

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
export type ScheduleCampaignInput = z.infer<typeof scheduleCampaignSchema>;
export type EmailBlockInput = z.infer<typeof emailBlockSchema>;
