import { createTeamService } from "@repo/api/workspaces";

import { db } from "@repo/database";

import { authService } from "./auth-service";

export const teamService = createTeamService({
  db,
  getSession: (headers: Headers) => authService.getSession(headers),
});
