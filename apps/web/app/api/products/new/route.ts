import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { PlanLimitError } from "@repo/api/plans";
import { ProductServiceError } from "@repo/api/products";
import { createProductSchema } from "@repo/api/products/schemas";

import { authService } from "@/services/auth-service";
import { productsService } from "@/services/products-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = await authService.getSession(await headers());
    if (!session) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Sign in to create products" } },
        { status: 401 },
      );
    }
    const body = createProductSchema.safeParse(await request.json());
    if (!body.success) {
      return NextResponse.json(
        { error: { code: "INVALID_INPUT", message: body.error.issues[0]?.message ?? "Invalid product" } },
        { status: 400 },
      );
    }
    const product = await productsService.createProduct(body.data, await headers());
    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    if (error instanceof ProductServiceError || error instanceof PlanLimitError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status },
      );
    }
    console.error("POST /api/products failed:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Something went wrong" } },
      { status: 500 },
    );
  }
}