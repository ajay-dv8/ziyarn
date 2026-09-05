import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";

import { WorkspaceServiceError } from "@repo/api/workspaces";

import { workspaceService } from "@/services/workspace-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = await (await import("@/services/auth-service")).authService.getSession(await headers());
    if (!session) {
      return NextResponse.json(
        { code: "UNAUTHORIZED", message: "Sign in to accept invites" },
        { status: 401 },
      );
    }

    let token: string;

    const body = await request.json().catch(() => null);
    if (body?.token) {
      token = body.token;
    } else {
      // Try to read from cookie
      const cookieStore = await cookies();
      token = cookieStore.get("pending_invite_token")?.value ?? "";
    }

    if (!token) {
      return NextResponse.json(
        { code: "INVALID_INPUT", message: "Invite token is required" },
        { status: 400 },
      );
    }

    const result = await workspaceService.acceptInvite(
      { token },
      await headers(),
    );

    // Clear the pending invite cookie
    const cookieStore = await cookies();
    cookieStore.delete("pending_invite_token");

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof WorkspaceServiceError) {
      return NextResponse.json(
        { code: error.code, message: error.message },
        { status: error.status },
      );
    }
    console.error("POST /api/invite/accept failed:", error);
    return NextResponse.json(
      { code: "INTERNAL", message: "Something went wrong" },
      { status: 500 },
    );
  }
}
