import { NextResponse } from "next/server";

import { EmailServiceError } from "@repo/api/email";

import { emailService } from "@/services/email-service";

export const runtime = "nodejs";

/**
 * Scheduler entrypoint — sends every campaign whose scheduled time has
 * arrived. Protected by the CRON_SECRET header; call it from a cron service
 * (e.g. Vercel Cron, GitHub Actions) on a regular interval.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const provided = request.headers.get("x-cron-secret");
  if (!secret || provided !== secret) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid cron secret" } },
      { status: 401 },
    );
  }
  try {
    const result = await emailService.processDueCampaigns();
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof EmailServiceError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status },
      );
    }
    console.error("GET /api/campaigns/process-scheduled failed:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Something went wrong" } },
      { status: 500 },
    );
  }
}