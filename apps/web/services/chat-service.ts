import { createAiService, type EmbedProviderConfig } from "@repo/ai";
import { createChatService } from "@repo/api/chat";

import { db } from "@repo/database";

import { logger } from "../lib/logger";

export const chatService = createChatService({ db });

const GEMINI_BASE_URL =
  process.env.GEMINI_BASE_URL ??
  "https://generativelanguage.googleapis.com/v1beta/openai/";
const OPENROUTER_BASE_URL =
  process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1";

/**
 * Platform embeddings, used by every scope without a BYO embedding model.
 * Knowledge vectors all live in one fixed `vector(1536)` space, so saving a
 * BYO model re-indexes the affected domains before the config changes.
 */
export const platformEmbedConfig: EmbedProviderConfig = {
  apiKey: process.env.GEMINI_API_KEY ?? "",
  baseURL: GEMINI_BASE_URL,
  model: process.env.EMBEDDING_MODEL || "gemini-embedding-001",
  // An empty env var must not become 0: the pgvector column is fixed at 1536.
  dimensions: Number(process.env.EMBEDDING_DIMENSIONS || 1536),
};

export const aiService = createAiService({
  chat: {
    apiKey: process.env.GEMINI_API_KEY ?? "",
    baseURL: GEMINI_BASE_URL,
    model: process.env.AI_MODEL ?? "gemini-3.6-flash",
  },
  fallback:
    process.env.OPENROUTER_API_KEY
      ? {
          apiKey: process.env.OPENROUTER_API_KEY,
          baseURL: OPENROUTER_BASE_URL,
          model: process.env.FALLBACK_MODEL ?? "openai/gpt-oss-20b:free",
        }
      : null,
  embed: platformEmbedConfig,
});

export { logger };
