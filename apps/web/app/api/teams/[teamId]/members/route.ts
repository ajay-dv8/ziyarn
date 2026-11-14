import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { TeamServiceError } from "@repo/api/workspaces";
import {
  inviteTeamMemberSchema,
  updateTeamMemberRoleSchema,
} from "@repo/api/workspaces";

import { teamService } from "@/services/team-service";

export const runtime = "nodejs";

/** Lists members of a team. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> },
) {
  try {
    const { teamId } = await params;
    const members = await teamService.listTeamMembers(teamId, await headers());
    return NextResponse.json({ members });
  } catch (error) {
    if (error instanceof TeamServiceError) {
      return NextResponse.json(
        { code: error.code, message: error.message },
        { status: error.status },
      );
    }
    console.error("GET /api/teams/[teamId]/members failed:", error);
    return NextResponse.json(
      { code: "INTERNAL", message: "Something went wrong" },
      { status: 500 },
    );
  }
}

/** Invites someone to join a team. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> },
) {
  try {
    const { teamId } = await params;
    const body = await request.json();
    const parsed = inviteTeamMemberSchema.safeParse(body);

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

    const result = await teamService.inviteTeamMember(
      teamId,
      parsed.data,
      await headers(),
    );
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof TeamServiceError) {
      return NextResponse.json(
        { code: error.code, message: error.message },
        { status: error.status },
      );
    }
    console.error("POST /api/teams/[teamId]/members failed:", error);
    return NextResponse.json(
      { code: "INTERNAL", message: "Something went wrong" },
      { status: 500 },
    );
  }
}

/** Updates a member's role. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> },
) {
  try {
    const { teamId } = await params;
    const body = await request.json();
    const parsed = updateTeamMemberRoleSchema.safeParse(body);

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

    const updated = await teamService.updateTeamMemberRole(
      teamId,
      parsed.data,
      await headers(),
    );
    return NextResponse.json({ member: updated });
  } catch (error) {
    if (error instanceof TeamServiceError) {
      return NextResponse.json(
        { code: error.code, message: error.message },
        { status: error.status },
      );
    }
    console.error("PATCH /api/teams/[teamId]/members failed:", error);
    return NextResponse.json(
      { code: "INTERNAL", message: "Something went wrong" },
      { status: 500 },
    );
  }
}

/** Removes a member from a team. */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> },
) {
  try {
    const { teamId } = await params;
    const body = await request.json();
    const { memberId } = body;

    if (!memberId) {
      return NextResponse.json(
        { code: "INVALID_INPUT", message: "memberId is required" },
        { status: 400 },
      );
    }

    await teamService.removeTeamMember(teamId, memberId, await headers());
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof TeamServiceError) {
      return NextResponse.json(
        { code: error.code, message: error.message },
        { status: error.status },
      );
    }
    console.error("DELETE /api/teams/[teamId]/members failed:", error);
    return NextResponse.json(
      { code: "INTERNAL", message: "Something went wrong" },
      { status: 500 },
    );
  }
}
