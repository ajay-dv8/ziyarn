import { createDataSourcesService } from "@repo/api/datasources";

import { db } from "@repo/database";

import { authService } from "./auth-service";
import { resolveEmbedderForAgent } from "./embedding-service";

export const dataSourcesService = createDataSourcesService({
  db,
  getSession: (headers: Headers) => authService.getSession(headers),
  resolveEmbedder: resolveEmbedderForAgent,
});
