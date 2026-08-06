import { createUsageService } from "@repo/api/usage";

import { db } from "@repo/database";

import { authService } from "./auth-service";

export const usageService = createUsageService({
  db,
  getSession: (headers: Headers) => authService.getSession(headers),
});