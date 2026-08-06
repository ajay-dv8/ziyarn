import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { AnalyticsServiceError } from "@repo/api/analytics";
import { getAnalyticsSchema } from "@repo/api/analytics/schemas";

import { authService } from "@/services/auth-service";
import { analyticsService } from "@/services/analytics-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const session = await authService.getSession(await headers());
    if (!session) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Sign in to view analytics" } },
        { status: 401 },
      );
    }
    const url = new URL(request.url);
    const input = getAnalyticsSchema.safeParse({
      domainId: url.searchParams.get("domainId"),
      range: url.searchParams.get("range") ?? undefined,
    });
    if (!input.success) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_INPUT",
            message: input.error.issues[0]?.message ?? "Invalid analytics query",
          },
        },
        { status: 400 },
      );
    }
    const data = await analyticsService.getAnalytics(input.data, await headers());
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof AnalyticsServiceError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status },
      );
    }
    console.error("GET /api/analytics failed:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Something went wrong" } },
      { status: 500 },
    );
  }
}