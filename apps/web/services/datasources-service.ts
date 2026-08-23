import { createDataSourcesService } from "@repo/api/datasources";

import { db } from "@repo/database";

import { authService } from "./auth-service";
import { aiService } from "./chat-service";

export const dataSourcesService = createDataSourcesService({
  db,
  getSession: (headers: Headers) => authService.getSession(headers),
  embed: (texts: string[]) => aiService.embed(texts),
  embeddingModel: aiService.embeddingModel,
});
