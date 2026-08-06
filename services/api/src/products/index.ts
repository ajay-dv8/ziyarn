export { createProductsService, ProductServiceError } from "@repo/api/products/server";

export type { ProductsService } from "@repo/api/products/server";

export {
  createProductSchema,
  listProductsSchema,
  productCurrencySchema,
  productIdSchema,
  updateProductSchema,
} from "@repo/api/products/schemas";

export type {
  CreateProductInput,
  ListProductsInput,
  ProductCurrency,
  ProductIdInput,
  UpdateProductInput,
} from "@repo/api/products/schemas";