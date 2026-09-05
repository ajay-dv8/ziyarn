import { createWorkspaceService } from "@repo/api/workspaces";

import { db } from "@repo/database";

import { authService } from "./auth-service";

export const workspaceService = createWorkspaceService({
  db,
  getSession: (headers: Headers) => authService.getSession(headers),
});
