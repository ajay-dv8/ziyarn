import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { EmailServiceError } from "@repo/api/email";
import { createCampaignSchema } from "@repo/api/email/schemas";

import { authService } from "@/services/auth-service";
import { emailService } from "@/services/email-service";
import { workspaceService } from "@/services/workspace-service";

export const runtime = "nodejs";

export async function GET() {
  try {
    const requestHeaders = await headers();
    const session = await authService.getSession(requestHeaders);
    if (!session) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Sign in to view campaigns" } },
        { status: 401 },
      );
    }
    // Campaigns belong to the active workspace. A user with no workspace sees
    // an empty list rather than every campaign they ever created.
    const workspaceId = await workspaceService.getActiveWorkspaceId(
      requestHeaders,
    );
    const campaigns = workspaceId
      ? await emailService.listCampaigns(workspaceId)
      : [];
    return NextResponse.json({ campaigns });
  } catch (error) {
    if (error instanceof EmailServiceError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status },
      );
    }
    console.error("GET /api/campaigns failed:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Something went wrong" } },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const requestHeaders = await headers();
    const session = await authService.getSession(requestHeaders);
    if (!session) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Sign in to create a campaign" } },
        { status: 401 },
      );
    }
    const workspaceId = await workspaceService.getActiveWorkspaceId(
      requestHeaders,
    );
    if (!workspaceId) {
      return NextResponse.json(
        {
          error: {
            code: "NO_WORKSPACE",
            message: "Create a workspace before creating a campaign",
          },
        },
        { status: 400 },
      );
    }
    const body = createCampaignSchema.safeParse(await request.json());
    if (!body.success) {
      return NextResponse.json(
        { error: { code: "INVALID_INPUT", message: body.error.issues[0]?.message ?? "Invalid campaign" } },
        { status: 400 },
      );
    }
    const campaign = await emailService.createCampaign(
      session.user.id,
      workspaceId,
      body.data,
    );
    return NextResponse.json({ campaign }, { status: 201 });
  } catch (error) {
    if (error instanceof EmailServiceError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status },
      );
    }
    console.error("POST /api/campaigns failed:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Something went wrong" } },
      { status: 500 },
    );
  }
}
