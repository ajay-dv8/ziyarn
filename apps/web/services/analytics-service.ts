import { createAnalyticsService } from "@repo/api/analytics";

import { db } from "@repo/database";

import { authService } from "./auth-service";

export const analyticsService = createAnalyticsService({
  db,
  getSession: (headers: Headers) => authService.getSession(headers),
});