import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { ProductServiceError } from "@repo/api/products";
import { updateProductSchema } from "@repo/api/products/schemas";

import { authService } from "@/services/auth-service";
import { productsService } from "@/services/products-service";

export const runtime = "nodejs";

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await authService.getSession(await headers());
    if (!session) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Sign in to update products" } },
        { status: 401 },
      );
    }
    const { id } = await params;
    const body = updateProductSchema.safeParse(await _request.json());
    if (!body.success) {
      return NextResponse.json(
        { error: { code: "INVALID_INPUT", message: body.error.issues[0]?.message ?? "Invalid product" } },
        { status: 400 },
      );
    }
    const product = await productsService.update(
      { ...body.data, productId: id },
      await headers(),
    );
    return NextResponse.json({ product });
  } catch (error) {
    if (error instanceof ProductServiceError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status },
      );
    }
    console.error("PATCH /api/products/[id] failed:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Something went wrong" } },
      { status: 500 },
    );
  }
}