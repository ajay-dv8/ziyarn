import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { PlanLimitError } from "@repo/api/plans";
import {
  WorkspaceServiceError,
  updateMemberRoleSchema,
} from "@repo/api/workspaces";

import { workspaceService } from "@/services/workspace-service";

export const runtime = "nodejs";

/** Changes a member's role. The owner's role is not changeable. */
export async function PATCH(
  request: Request,
  {
    params,
  }: { params: Promise<{ workspaceId: string; memberId: string }> },
) {
  try {
    const { workspaceId, memberId } = await params;
    const body = await request.json();
    const parsed = updateMemberRoleSchema.safeParse({
      ...body,
      memberId,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { code: "INVALID_INPUT", message: "That role is not valid" },
        { status: 400 },
      );
    }

    const member = await workspaceService.updateMemberRole(
      workspaceId,
      parsed.data,
      await headers(),
    );
    return NextResponse.json({ member });
  } catch (error) {
    if (error instanceof WorkspaceServiceError || error instanceof PlanLimitError) {
      return NextResponse.json(
        { code: error.code, message: error.message },
        { status: error.status },
      );
    }
    console.error("PATCH /api/workspace/[workspaceId]/members/[memberId] failed:", error);
    return NextResponse.json(
      { code: "INTERNAL", message: "Something went wrong" },
      { status: 500 },
    );
  }
}

/** Removes a member from the team. */
export async function DELETE(
  _request: Request,
  {
    params,
  }: { params: Promise<{ workspaceId: string; memberId: string }> },
) {
  try {
    const { workspaceId, memberId } = await params;
    await workspaceService.removeMember(
      workspaceId,
      memberId,
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
      "DELETE /api/workspace/[workspaceId]/members/[memberId] failed:",
      error,
    );
    return NextResponse.json(
      { code: "INTERNAL", message: "Something went wrong" },
      { status: 500 },
    );
  }
}
