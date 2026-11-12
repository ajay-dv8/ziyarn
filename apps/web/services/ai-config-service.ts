import { createAiConfigService } from "@repo/api/ai";

import { db } from "@repo/database";

import { authService } from "./auth-service";
import { platformEmbedConfig } from "./chat-service";

export const aiConfigService = createAiConfigService({
  db,
  getSession: (headers: Headers) => authService.getSession(headers),
  encryptionSecret: process.env.AI_KEY_ENCRYPTION_SECRET,
  platformConfigured: Boolean(process.env.GEMINI_API_KEY),
  platformEmbed: platformEmbedConfig,
});
