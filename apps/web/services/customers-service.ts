import { createCustomersService } from "@repo/api/customers";

import { db } from "@repo/database";

import { authService } from "./auth-service";

export const customersService = createCustomersService({
  db,
  getSession: (headers: Headers) => authService.getSession(headers),
});
