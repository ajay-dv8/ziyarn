import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { PlanLimitError } from "@repo/api/plans";
import { ProductServiceError } from "@repo/api/products";
import { listProductsSchema } from "@repo/api/products/schemas";

import { authService } from "@/services/auth-service";
import { productsService } from "@/services/products-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const session = await authService.getSession(await headers());
    if (!session) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Sign in to view products" } },
        { status: 401 },
      );
    }
    const url = new URL(request.url);
    const input = listProductsSchema.safeParse({
      domainId: url.searchParams.get("domainId"),
    });
    if (!input.success) {
      return NextResponse.json(
        { error: { code: "INVALID_INPUT", message: input.error.issues[0]?.message ?? "Invalid domainId" } },
        { status: 400 },
      );
    }
    const products = await productsService.listProducts(input.data, await headers());
    return NextResponse.json({ products });
  } catch (error) {
    if (error instanceof ProductServiceError || error instanceof PlanLimitError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status },
      );
    }
    console.error("GET /api/products failed:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Something went wrong" } },
      { status: 500 },
    );
  }
}