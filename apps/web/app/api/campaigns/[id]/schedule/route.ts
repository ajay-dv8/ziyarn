import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { EmailServiceError } from "@repo/api/email";
import { scheduleCampaignSchema } from "@repo/api/email/schemas";

import { authService } from "@/services/auth-service";
import { emailService } from "@/services/email-service";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await authService.getSession(await headers());
    if (!session) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Sign in to schedule a campaign" } },
        { status: 401 },
      );
    }
    const body = scheduleCampaignSchema.safeParse(await request.json());
    if (!body.success) {
      return NextResponse.json(
        { error: { code: "INVALID_INPUT", message: body.error.issues[0]?.message ?? "Invalid scheduled time" } },
        { status: 400 },
      );
    }
    const { id } = await params;
    const campaign = await emailService.scheduleCampaign(session.user.id, id, body.data);
    return NextResponse.json({ campaign });
  } catch (error) {
    if (error instanceof EmailServiceError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status },
      );
    }
    console.error("POST /api/campaigns/[id]/schedule failed:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Something went wrong" } },
      { status: 500 },
    );
  }
}