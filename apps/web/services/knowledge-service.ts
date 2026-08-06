import { createKnowledgeService } from "@repo/api/knowledge";

import { db } from "@repo/database";

import { authService } from "./auth-service";
import { aiService } from "./chat-service";

export const knowledgeService = createKnowledgeService({
  db,
  getSession: (headers: Headers) => authService.getSession(headers),
  embed: (texts: string[]) => aiService.embed(texts),
  embeddingModel: aiService.embeddingModel,
});
