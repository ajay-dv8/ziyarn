import { count, desc, eq } from "drizzle-orm";

import type { Database } from "@repo/database";
import { domains } from "@repo/database/schema/domains";
import { products, type Product } from "@repo/database/schema/products";

import { assertCanCreateProduct, getPlanLimits } from "@repo/api/plans";
import type { SessionWithUser } from "@repo/api/domains";
import type {
  CreateProductInput,
  UpdateProductInput,
} from "@repo/api/products/schemas";

export class ProductServiceError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ProductServiceError";
  }
}

const unauthorized = () =>
  new ProductServiceError(401, "UNAUTHORIZED", "You must be signed in");

const forbidden = () =>
  new ProductServiceError(403, "FORBIDDEN", "You do not own this domain");

const notFound = () =>
  new ProductServiceError(404, "NOT_FOUND", "Product not found");

export type ProductsService = ReturnType<typeof createProductsService>;

/**
 * Owner-scoped catalog service. Every read/write verifies the domain belongs
 * to the session user. Creating products is gated by the domain's plan.
 */
export function createProductsService(deps: {
  db: Database;
  getSession: (headers: Headers) => Promise<SessionWithUser>;
}) {
  const { db, getSession } = deps;

  const requireOwnedProduct = async (
    productId: string,
    headers: Headers,
  ): Promise<NonNullable<SessionWithUser> & { product: Product }> => {
    const session = await getSession(headers);
    if (!session) throw unauthorized();

    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);

    if (!product) throw notFound();

    const [domain] = await db
      .select()
      .from(domains)
      .where(eq(domains.id, product.domainId))
      .limit(1);

    if (!domain || domain.ownerId !== session.user.id) throw forbidden();

    return { ...session, product };
  };

  return {
    /** Lists products for a domain the session user owns, newest first. */
    listProducts: async (
      input: { domainId: string },
      headers: Headers,
    ): Promise<Product[]> => {
      const session = await getSession(headers);
      if (!session) throw unauthorized();

      const [domain] = await db
        .select()
        .from(domains)
        .where(eq(domains.id, input.domainId))
        .limit(1);
      if (!domain) throw new ProductServiceError(404, "NOT_FOUND", "Domain not found");
      if (domain.ownerId !== session.user.id) throw forbidden();

      return db
        .select()
        .from(products)
        .where(eq(products.domainId, input.domainId))
        .orderBy(desc(products.createdAt));
    },

    /** Creates a product in a domain the session user owns (plan-gated). */
    async createProduct(
      input: CreateProductInput,
      headers: Headers,
    ): Promise<Product> {
      const session = await getSession(headers);
      if (!session) throw unauthorized();

      const [domain] = await db
        .select()
        .from(domains)
        .where(eq(domains.id, input.domainId))
        .limit(1);
      if (!domain) throw new ProductServiceError(404, "NOT_FOUND", "Domain not found");
      if (domain.ownerId !== session.user.id) throw forbidden();

      const rows = await db
        .select({ value: count() })
        .from(products)
        .where(eq(products.domainId, input.domainId));

      assertCanCreateProduct(getPlanLimits(domain.plan), rows[0]?.value ?? 0);

      const [row] = await db
        .insert(products)
        .values({
          domainId: input.domainId,
          name: input.name,
          description: input.description ?? null,
          priceCents: input.priceCents,
          currency: input.currency,
        })
        .returning();

      if (!row) {
        throw new ProductServiceError(500, "CREATE_FAILED", "Failed to create product");
      }
      return row;
    },

    /** Updates a product the session user owns. */
    async update(
      input: UpdateProductInput & { productId: string },
      headers: Headers,
    ): Promise<Product> {
      const { product } = await requireOwnedProduct(input.productId, headers);

      const [row] = await db
        .update(products)
        .set({
          name: input.name ?? product.name,
          description: input.description !== undefined
            ? input.description
            : product.description,
          priceCents: input.priceCents ?? product.priceCents,
          currency: input.currency ?? product.currency,
          active: input.active ?? product.active,
          updatedAt: new Date(),
        })
        .where(eq(products.id, input.productId))
        .returning();

      if (!row) throw notFound();
      return row;
    },

    /** Deletes a product the session user owns. */
    async deleteProduct(productId: string, headers: Headers): Promise<void> {
      const { product } = await requireOwnedProduct(productId, headers);
      await db.delete(products).where(eq(products.id, product.id));
    },
  };
}