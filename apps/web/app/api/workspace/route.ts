import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { PlanLimitError } from "@repo/api/plans";
import {
  WorkspaceServiceError,
  createWorkspaceSchema,
} from "@repo/api/workspaces";

import { workspaceService } from "@/services/workspace-service";

export const runtime = "nodejs";

/** Lists the teams the caller belongs to, with their role in each. */
export async function GET() {
  try {
    const workspaces = await workspaceService.listWorkspaces(await headers());
    return NextResponse.json({ workspaces });
  } catch (error) {
    if (error instanceof WorkspaceServiceError) {
      return NextResponse.json(
        { code: error.code, message: error.message },
        { status: error.status },
      );
    }
    console.error("GET /api/workspace failed:", error);
    return NextResponse.json(
      { code: "INTERNAL", message: "Something went wrong" },
      { status: 500 },
    );
  }
}

/** Creates a team with the caller as its owner. Plan limits apply. */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = createWorkspaceSchema.safeParse(body);

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

    const workspace = await workspaceService.createWorkspace(
      parsed.data,
      await headers(),
    );
    return NextResponse.json({ workspace }, { status: 201 });
  } catch (error) {
    if (error instanceof WorkspaceServiceError || error instanceof PlanLimitError) {
      return NextResponse.json(
        { code: error.code, message: error.message },
        { status: error.status },
      );
    }
    console.error("POST /api/workspace failed:", error);
    return NextResponse.json(
      { code: "INTERNAL", message: "Something went wrong" },
      { status: 500 },
    );
  }
}
