import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { TeamServiceError } from "@repo/api/workspaces";
import { acceptTeamInviteSchema } from "@repo/api/workspaces";

import { teamService } from "@/services/team-service";

export const runtime = "nodejs";

/** Accepts a team invite by token. */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = acceptTeamInviteSchema.safeParse(body);

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

    const result = await teamService.acceptTeamInvite(
      parsed.data,
      await headers(),
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof TeamServiceError) {
      return NextResponse.json(
        { code: error.code, message: error.message },
        { status: error.status },
      );
    }
    console.error("POST /api/teams/invites/accept failed:", error);
    return NextResponse.json(
      { code: "INTERNAL", message: "Something went wrong" },
      { status: 500 },
    );
  }
}
