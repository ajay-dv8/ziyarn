import { createSettingsService } from "@repo/api/settings";

import { auth } from "../lib/auth";
import { db } from "@repo/database";
import { authService } from "./auth-service";

export const settingsService = createSettingsService({
  db,
  getSession: (headers: Headers) => authService.getSession(headers),
  auth,
});
