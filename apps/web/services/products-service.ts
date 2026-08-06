import { createProductsService } from "@repo/api/products";

import { db } from "@repo/database";

import { authService } from "./auth-service";

export const productsService = createProductsService({
  db,
  getSession: (headers: Headers) => authService.getSession(headers),
});