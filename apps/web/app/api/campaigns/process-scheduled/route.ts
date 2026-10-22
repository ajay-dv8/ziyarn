import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { EmailServiceError } from "@repo/api/email";

import { emailService } from "@/services/email-service";
import { pruneRateLimitWindows } from "@/lib/rate-limit-db";

export const runtime = "nodejs";

/**
 * Sending is serial and this endpoint runs on a serverless host. Keep the
 * platform timeout below the scheduler's patience; the service caps each run
 * at ten campaigns.
 */
export const maxDuration = 60;

function secretsMatch(provided: string, secret: string): boolean {
  const providedBytes = Buffer.from(provided);
  const secretBytes = Buffer.from(secret);
  return (
    providedBytes.length === secretBytes.length &&
    timingSafeEqual(providedBytes, secretBytes)
  );
}

/**
 * Scheduler entrypoint — sends every campaign whose scheduled time has
 * arrived and prunes expired chat rate-limit windows. Protected by the
 * CRON_SECRET header; called by the GitHub Actions cron workflow on a regular
 * interval.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      {
        error: {
          code: "SCHEDULER_NOT_CONFIGURED",
          message: "CRON_SECRET is not set",
        },
      },
      { status: 503 },
    );
  }

  const provided = request.headers.get("x-cron-secret");
  if (!provided || !secretsMatch(provided, secret)) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid cron secret" } },
      { status: 401 },
    );
  }
  let rateLimitWindowsPruned = 0;
  try {
    rateLimitWindowsPruned = await pruneRateLimitWindows();
  } catch (error) {
    // Rate-limit cleanup is housekeeping: a failure must not stop campaign
    // delivery. The error is already reported to Sentry by the pruner.
    console.error("Rate-limit window pruning failed:", error);
  }

  try {
    const result = await emailService.processDueCampaigns();
    return NextResponse.json(
      { ...result, rateLimitWindowsPruned },
      { headers: { "cache-control": "no-store" } },
    );
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