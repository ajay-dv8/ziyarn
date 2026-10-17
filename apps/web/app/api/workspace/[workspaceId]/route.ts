import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { PlanLimitError } from "@repo/api/plans";
import {
  WorkspaceServiceError,
  renameWorkspaceSchema,
} from "@repo/api/workspaces";

import { workspaceService } from "@/services/workspace-service";

export const runtime = "nodejs";

/** Renames a team. Owners and admins only. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await params;
    const body = await request.json();
    const parsed = renameWorkspaceSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          code: "INVALID_INPUT",
          message: "Please fix the highlighted fields",
          fieldErrors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const workspace = await workspaceService.updateWorkspace(
      workspaceId,
      parsed.data,
      await headers(),
    );
    return NextResponse.json({ workspace });
  } catch (error) {
    if (error instanceof WorkspaceServiceError || error instanceof PlanLimitError) {
      return NextResponse.json(
        { code: error.code, message: error.message },
        { status: error.status },
      );
    }
    console.error("PATCH /api/workspace/[workspaceId] failed:", error);
    return NextResponse.json(
      { code: "INTERNAL", message: "Something went wrong" },
      { status: 500 },
    );
  }
}

/**
 * Deletes a team, its memberships and its pending invites. Domains belong to
 * the people who created them and are not touched.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await params;
    await workspaceService.deleteWorkspace(workspaceId, await headers());
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof WorkspaceServiceError) {
      return NextResponse.json(
        { code: error.code, message: error.message },
        { status: error.status },
      );
    }
    console.error("DELETE /api/workspace/[workspaceId] failed:", error);
    return NextResponse.json(
      { code: "INTERNAL", message: "Something went wrong" },
      { status: 500 },
    );
  }
}
