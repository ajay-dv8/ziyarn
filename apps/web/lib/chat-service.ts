import { createAiService } from "@repo/ai";
import { createChatService } from "@repo/api/chat";

import { db } from "@repo/database";

import { logger } from "./logger";

export const chatService = createChatService({ db });

const GEMINI_BASE_URL =
  process.env.GEMINI_BASE_URL ??
  "https://generativelanguage.googleapis.com/v1beta/openai/";
const OPENROUTER_BASE_URL =
  process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1";

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
  embed: {
    apiKey: process.env.GEMINI_API_KEY ?? "",
    baseURL: GEMINI_BASE_URL,
    model: process.env.EMBEDDING_MODEL ?? "gemini-embedding-001",
    dimensions: Number(process.env.EMBEDDING_DIMENSIONS ?? 1536),
  },
});

export { logger };
