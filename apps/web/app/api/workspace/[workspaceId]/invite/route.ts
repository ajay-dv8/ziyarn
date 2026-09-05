import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { WorkspaceServiceError } from "@repo/api/workspaces";

import { workspaceService } from "@/services/workspace-service";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await params;
    const body = await request.json();
    const result = await workspaceService.inviteMember(
      workspaceId,
      body,
      await headers(),
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof WorkspaceServiceError) {
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
