import { NextResponse } from "next/server";

import { UsageServiceError } from "@repo/api/usage";
import { usagePeriodSchema } from "@repo/api/usage/schemas";

import { usageService } from "@/services/usage-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const input = usagePeriodSchema.safeParse({
      period: url.searchParams.get("period") ?? undefined,
    });
    if (!input.success) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_INPUT",
            message: input.error.issues[0]?.message ?? "Invalid usage query",
          },
        },
        { status: 400 },
      );
    }
    const data = await usageService.getUsageForSession(request.headers, input.data);
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof UsageServiceError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status },
      );
    }
    console.error("GET /api/usage failed:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Something went wrong" } },
      { status: 500 },
    );
  }
}