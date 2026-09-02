import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { DataSourceServiceError } from "@repo/api/datasources";

import { authService } from "@/services/auth-service";
import { dataSourcesService } from "@/services/datasources-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = await authService.getSession(await headers());
    if (!session) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Sign in to sync orders" } },
        { status: 401 },
      );
    }

    const raw = (await request.json()) as { domainId?: string };
    if (!raw.domainId) {
      return NextResponse.json(
        { error: { code: "INVALID_INPUT", message: "domainId is required" } },
        { status: 400 },
      );
    }

    const result = await dataSourcesService.syncOrders(
      { domainId: raw.domainId },
      request.headers,
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof DataSourceServiceError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status },
      );
    }
    console.error("POST /api/orders/sync-database failed:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Something went wrong" } },
      { status: 500 },
    );
  }
}
