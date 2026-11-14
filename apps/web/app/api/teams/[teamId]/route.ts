import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { TeamServiceError } from "@repo/api/workspaces";
import { renameTeamSchema } from "@repo/api/workspaces";

import { teamService } from "@/services/team-service";

export const runtime = "nodejs";

/** Returns a team the caller belongs to. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> },
) {
  try {
    const { teamId } = await params;
    const team = await teamService.getTeam(teamId, await headers());
    return NextResponse.json({ team });
  } catch (error) {
    if (error instanceof TeamServiceError) {
      return NextResponse.json(
        { code: error.code, message: error.message },
        { status: error.status },
      );
    }
    console.error("GET /api/teams/[teamId] failed:", error);
    return NextResponse.json(
      { code: "INTERNAL", message: "Something went wrong" },
      { status: 500 },
    );
  }
}

/** Renames a team. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> },
) {
  try {
    const { teamId } = await params;
    const body = await request.json();
    const parsed = renameTeamSchema.safeParse(body);

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

    const team = await teamService.updateTeam(
      teamId,
      parsed.data,
      await headers(),
    );
    return NextResponse.json({ team });
  } catch (error) {
    if (error instanceof TeamServiceError) {
      return NextResponse.json(
        { code: error.code, message: error.message },
        { status: error.status },
      );
    }
    console.error("PATCH /api/teams/[teamId] failed:", error);
    return NextResponse.json(
      { code: "INTERNAL", message: "Something went wrong" },
      { status: 500 },
    );
  }
}

/** Deletes a team. */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> },
) {
  try {
    const { teamId } = await params;
    await teamService.deleteTeam(teamId, await headers());
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof TeamServiceError) {
      return NextResponse.json(
        { code: error.code, message: error.message },
        { status: error.status },
      );
    }
    console.error("DELETE /api/teams/[teamId] failed:", error);
    return NextResponse.json(
      { code: "INTERNAL", message: "Something went wrong" },
      { status: 500 },
    );
  }
}
