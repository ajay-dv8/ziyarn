import { createNotificationsService } from "@repo/api/notifications";

import { db } from "@repo/database";

import { authService } from "./auth-service";

export const notificationsService = createNotificationsService({
  db,
  getSession: (headers: Headers) => authService.getSession(headers),
});
