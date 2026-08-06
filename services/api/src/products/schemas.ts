import { z } from "zod";

export const productCurrencySchema = z.enum(["usd", "eur", "gbp"]);

export const createProductSchema = z.object({
  domainId: z.string().uuid(),
  name: z.string().min(1).max(120),
  description: z.string().max(1000).optional(),
  priceCents: z.number().int().min(0).max(100_000_000),
  currency: productCurrencySchema.default("usd"),
});

export const updateProductSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(1000).nullable().optional(),
  priceCents: z.number().int().min(0).max(100_000_000).optional(),
  currency: productCurrencySchema.optional(),
  active: z.boolean().optional(),
});

export const productIdSchema = z.object({
  productId: z.string().uuid(),
});

export const listProductsSchema = z.object({
  domainId: z.string().uuid(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ProductIdInput = z.infer<typeof productIdSchema>;
export type ListProductsInput = z.infer<typeof listProductsSchema>;
export type ProductCurrency = z.infer<typeof productCurrencySchema>;