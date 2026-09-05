import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { WorkspaceServiceError } from "@repo/api/workspaces";

import { workspaceService } from "@/services/workspace-service";

export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
  {
    params,
  }: { params: Promise<{ workspaceId: string; inviteId: string }> },
) {
  try {
    const { workspaceId, inviteId } = await params;
    await workspaceService.revokeInvite(
      workspaceId,
      inviteId,
      await headers(),
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof WorkspaceServiceError) {
      return NextResponse.json(
        { code: error.code, message: error.message },
        { status: error.status },
      );
    }
    console.error(
      "DELETE /api/workspace/[workspaceId]/invites/[inviteId] failed:",
      error,
    );
    return NextResponse.json(
      { code: "INTERNAL", message: "Something went wrong" },
      { status: 500 },
    );
  }
}
