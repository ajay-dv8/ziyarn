import { createBlobKnowledgeStorage } from "@repo/api/knowledge/blob-storage";
import { createKnowledgeService } from "@repo/api/knowledge";
import { createLocalKnowledgeStorage } from "@repo/api/knowledge/storage";

import { db } from "@repo/database";

import { authService } from "./auth-service";
import { aiService } from "./chat-service";

export const knowledgeService = createKnowledgeService({
  db,
  getSession: (headers: Headers) => authService.getSession(headers),
  embed: (texts: string[]) => aiService.embed(texts),
  embeddingModel: aiService.embeddingModel,
  storage: process.env.BLOB_READ_WRITE_TOKEN
    ? createBlobKnowledgeStorage()
    : createLocalKnowledgeStorage(),
});