import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { PlanLimitError } from "@repo/api/plans";
import { TeamServiceError } from "@repo/api/workspaces";
import { createTeamSchema } from "@repo/api/workspaces";

import { teamService } from "@/services/team-service";

export const runtime = "nodejs";

/** Lists teams in a workspace the caller belongs to. */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId");
    if (!workspaceId) {
      return NextResponse.json(
        { code: "INVALID_INPUT", message: "workspaceId is required" },
        { status: 400 },
      );
    }

    const teams = await teamService.listTeams(workspaceId, await headers());
    return NextResponse.json({ teams });
  } catch (error) {
    if (error instanceof TeamServiceError) {
      return NextResponse.json(
        { code: error.code, message: error.message },
        { status: error.status },
      );
    }
    console.error("GET /api/teams failed:", error);
    return NextResponse.json(
      { code: "INTERNAL", message: "Something went wrong" },
      { status: 500 },
    );
  }
}

/** Creates a team inside a workspace. */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = createTeamSchema.safeParse(body);

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

    const team = await teamService.createTeam(
      parsed.data,
      await headers(),
    );
    return NextResponse.json({ team }, { status: 201 });
  } catch (error) {
    if (
      error instanceof TeamServiceError ||
      error instanceof PlanLimitError
    ) {
      return NextResponse.json(
        { code: error.code, message: error.message },
        { status: error.status },
      );
    }
    console.error("POST /api/teams failed:", error);
    return NextResponse.json(
      { code: "INTERNAL", message: "Something went wrong" },
      { status: 500 },
    );
  }
}
