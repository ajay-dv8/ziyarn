import { z } from "zod";

import { AI_PROVIDER_IDS, type AiProviderId } from "@repo/api/ai/providers";

export const aiProviderSchema = z.enum(
  AI_PROVIDER_IDS as [AiProviderId, ...AiProviderId[]],
);

/**
 * What the settings form submits.
 *
 * `apiKey` is only present when the owner typed a new one; omitting it keeps
 * the stored key. `clearApiKey` explicitly removes it. Requiredness of the
 * model (and of the base URL for a custom endpoint) is enforced in the service
 * after merging with the stored row — editing only the model must not have to
 * resend the URL.
 */
export const updateAiConfigSchema = z.object({
  provider: aiProviderSchema,
  model: z.string().trim().max(200).optional(),
  apiKey: z.string().trim().max(500).optional(),
  clearApiKey: z.boolean().optional(),
  baseUrl: z
    .string()
    .trim()
    .max(500)
    .refine(
      (value) => value === "" || /^https?:\/\//.test(value),
      "Base URL must start with http:// or https://",
    )
    .optional(),
});

export type UpdateAiConfigInput = z.infer<typeof updateAiConfigSchema>;

/** Safe shape for the dashboard — the key is never included in full. */
export type AiConfigView = {
  provider: AiProviderId;
  model: string | null;
  baseUrl: string | null;
  maskedApiKey: string | null;
  hasApiKey: boolean;
};

/** The provider config the chat runtime needs, after decryption. */
export type ResolvedAiProvider = {
  provider: AiProviderId;
  apiKey: string;
  baseURL: string;
  model: string;
};
