import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { EmailServiceError } from "@repo/api/email";

import { authService } from "@/services/auth-service";
import { emailService } from "@/services/email-service";
import { workspaceService } from "@/services/workspace-service";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const requestHeaders = await headers();
    const session = await authService.getSession(requestHeaders);
    if (!session) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Sign in to send a campaign" } },
        { status: 401 },
      );
    }
    const workspaceId = await workspaceService.getActiveWorkspaceId(
      requestHeaders,
    );
    if (!workspaceId) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Campaign not found" } },
        { status: 404 },
      );
    }
    const { id } = await params;
    const { recipients } = await emailService.sendCampaign(workspaceId, id);
    return NextResponse.json({ recipients });
  } catch (error) {
    if (error instanceof EmailServiceError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status },
      );
    }
    console.error("POST /api/campaigns/[id]/send failed:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Something went wrong" } },
      { status: 500 },
    );
  }
}
