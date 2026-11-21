import { count, desc, eq } from "drizzle-orm";

import type { Database } from "@repo/database";
import type { Domain } from "@repo/database/schema/domains";
import { products, type Product } from "@repo/database/schema/products";

import { assertCanCreateProduct, getPlanLimits } from "@repo/api/plans";
import type { SessionWithUser } from "@repo/api/domains";
import {
  findDomainAccess,
  roleCanEditDomainData,
} from "@repo/api/workspaces/access";
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
  new ProductServiceError(
    403,
    "FORBIDDEN",
    "You are not a member of this domain's workspace",
  );
const forbiddenMutation = () =>
  new ProductServiceError(
    403,
    "FORBIDDEN",
    "Viewers can only read this domain",
  );

const domainNotFound = () =>
  new ProductServiceError(404, "DOMAIN_NOT_FOUND", "Domain not found");

const notFound = () =>
  new ProductServiceError(404, "NOT_FOUND", "Product not found");

export type ProductsService = ReturnType<typeof createProductsService>;

/**
 * Workspace-scoped catalog service. Access follows membership in the domain's
 * workspace; writes require owner/admin/member. Creating products is also
 * gated by the domain's plan.
 */
export function createProductsService(deps: {
  db: Database;
  getSession: (headers: Headers) => Promise<SessionWithUser>;
}) {
  const { db, getSession } = deps;

  const requireDomainAccess = async (
    domainId: string,
    headers: Headers,
    mutate = false,
  ): Promise<{
    session: NonNullable<SessionWithUser>;
    domain: Domain;
  }> => {
    const session = await getSession(headers);
    if (!session) throw unauthorized();

    const access = await findDomainAccess(db, domainId, session.user.id);
    if (access.kind === "not_found") throw domainNotFound();
    if (access.kind === "forbidden") throw forbidden();
    if (mutate && !roleCanEditDomainData(access.role)) {
      throw forbiddenMutation();
    }

    return { session, domain: access.domain };
  };

  const requireProductAccess = async (
    productId: string,
    headers: Headers,
    mutate = false,
  ): Promise<{ session: NonNullable<SessionWithUser>; product: Product }> => {
    const session = await getSession(headers);
    if (!session) throw unauthorized();

    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);

    if (!product) throw notFound();

    // The product's domain is the access boundary, not the product row.
    const access = await findDomainAccess(db, product.domainId, session.user.id);
    if (access.kind === "not_found") throw notFound();
    if (access.kind === "forbidden") throw forbidden();
    if (mutate && !roleCanEditDomainData(access.role)) {
      throw forbiddenMutation();
    }

    return { session, product };
  };

  return {
    /** Lists products for a domain the session user can reach, newest first. */
    listProducts: async (
      input: { domainId: string },
      headers: Headers,
    ): Promise<Product[]> => {
      await requireDomainAccess(input.domainId, headers);

      return db
        .select()
        .from(products)
        .where(eq(products.domainId, input.domainId))
        .orderBy(desc(products.createdAt));
    },

    /** Creates a product in a domain the session user can edit (plan-gated). */
    async createProduct(
      input: CreateProductInput,
      headers: Headers,
    ): Promise<Product> {
      const { domain } = await requireDomainAccess(input.domainId, headers, true);

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
          imageUrl: input.imageUrl ?? null,
          productUrl: input.productUrl ?? null,
          priceCents: input.priceCents,
          currency: input.currency,
        })
        .returning();

      if (!row) {
        throw new ProductServiceError(500, "CREATE_FAILED", "Failed to create product");
      }
      return row;
    },

    /** Updates a product in a domain the session user can edit. */
    async update(
      input: UpdateProductInput & { productId: string },
      headers: Headers,
    ): Promise<Product> {
      const { product } = await requireProductAccess(
        input.productId,
        headers,
        true,
      );

      const [row] = await db
        .update(products)
        .set({
          name: input.name ?? product.name,
          description: input.description !== undefined
            ? input.description
            : product.description,
          imageUrl: input.imageUrl !== undefined ? input.imageUrl : product.imageUrl,
          productUrl:
            input.productUrl !== undefined ? input.productUrl : product.productUrl,
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

    /** Deletes a product in a domain the session user can edit. */
    async deleteProduct(productId: string, headers: Headers): Promise<void> {
      const { product } = await requireProductAccess(
        productId,
        headers,
        true,
      );
      await db.delete(products).where(eq(products.id, product.id));
    },
  };
}
