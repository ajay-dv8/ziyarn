import { createDomainsService } from "@repo/api/domains";

import { db } from "@repo/database";

import { authService } from "./auth-service";

export const domainsService = createDomainsService({
  db,
  getSession: (headers: Headers) => authService.getSession(headers),
});
