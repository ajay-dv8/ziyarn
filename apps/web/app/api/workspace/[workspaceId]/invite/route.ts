import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { PlanLimitError } from "@repo/api/plans";
import {
  WorkspaceServiceError,
  inviteMemberSchema,
  type WorkspaceRole,
} from "@repo/api/workspaces";

import { sendWorkspaceInviteEmail } from "@/lib/workspace-invite-email";
import { workspaceService } from "@/services/workspace-service";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await params;
    const body = await request.json();
    const parsed = inviteMemberSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          code: "INVALID_INPUT",
          message: "Enter a valid email address",
          fieldErrors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const result = await workspaceService.inviteMember(
      workspaceId,
      parsed.data,
      await headers(),
    );

    const delivery = await sendWorkspaceInviteEmail({
      to: result.invite.email,
      workspaceName: result.workspace.name,
      role: result.invite.role as WorkspaceRole,
      inviteUrl: result.inviteUrl,
      expiresAt: result.invite.expiresAt,
    });

    return NextResponse.json(
      {
        invite: result.invite,
        inviteUrl: result.inviteUrl,
        emailed: delivery.emailed,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof WorkspaceServiceError || error instanceof PlanLimitError) {
      return NextResponse.json(
        { code: error.code, message: error.message },
        { status: error.status },
      );
    }
    console.error("POST /api/workspace/[workspaceId]/invite failed:", error);
    return NextResponse.json(
      { code: "INTERNAL", message: "Something went wrong" },
      { status: 500 },
    );
  }
}
