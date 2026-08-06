import { createAgentsService } from "@repo/api/agents";

import { db } from "@repo/database";

import { authService } from "./auth-service";

export const agentsService = createAgentsService({
  db,
  getSession: (headers: Headers) => authService.getSession(headers),
});