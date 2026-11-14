import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { TeamServiceError } from "@repo/api/workspaces";

import { teamService } from "@/services/team-service";

export const runtime = "nodejs";

/** Lists pending invites for a team. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> },
) {
  try {
    const { teamId } = await params;
    const invites = await teamService.listTeamInvites(teamId, await headers());
    return NextResponse.json({ invites });
  } catch (error) {
    if (error instanceof TeamServiceError) {
      return NextResponse.json(
        { code: error.code, message: error.message },
        { status: error.status },
      );
    }
    console.error("GET /api/teams/[teamId]/invites failed:", error);
    return NextResponse.json(
      { code: "INTERNAL", message: "Something went wrong" },
      { status: 500 },
    );
  }
}

/** Revokes a pending team invite. */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> },
) {
  try {
    const { teamId } = await params;
    const body = await request.json();
    const { inviteId } = body;

    if (!inviteId) {
      return NextResponse.json(
        { code: "INVALID_INPUT", message: "inviteId is required" },
        { status: 400 },
      );
    }

    await teamService.revokeTeamInvite(teamId, inviteId, await headers());
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof TeamServiceError) {
      return NextResponse.json(
        { code: error.code, message: error.message },
        { status: error.status },
      );
    }
    console.error("DELETE /api/teams/[teamId]/invites failed:", error);
    return NextResponse.json(
      { code: "INTERNAL", message: "Something went wrong" },
      { status: 500 },
    );
  }
}
