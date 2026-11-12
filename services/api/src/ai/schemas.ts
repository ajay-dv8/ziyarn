import { z } from "zod";

import { AI_PROVIDER_IDS, type AiProviderId } from "@repo/api/ai/providers";

/** pgvector column width. Every stored embedding must use this dimension. */
export const EMBEDDING_DIMENSIONS = 1536;

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
  /**
   * Optional BYO embeddings model for this scope. An empty string clears it and
   * returns the scope to the next level's embeddings (account → platform).
   */
  embeddingModel: z.string().trim().max(200).optional(),
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
  embeddingModel: string | null;
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

/** The embeddings config the knowledge runtime needs, after decryption. */
export type ResolvedEmbeddingProvider = {
  provider: AiProviderId;
  apiKey: string;
  baseURL: string;
  model: string;
};
