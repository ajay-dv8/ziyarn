import { z } from "zod";

export const createCampaignSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  subject: z.string().trim().min(1, "Subject is required").max(200),
  body: z.string().trim().min(1, "Body is required").max(20000),
});

export const scheduleCampaignSchema = z.object({
  scheduledAt: z.string().datetime({ offset: true }),
});

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
export type ScheduleCampaignInput = z.infer<typeof scheduleCampaignSchema>;
