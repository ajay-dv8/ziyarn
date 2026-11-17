import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { AgentServiceError } from "@repo/api/agents";

import { agentsService } from "@/services/agents-service";
import { authService } from "@/services/auth-service";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await authService.getSession(await headers());
    if (!session) {
      return NextResponse.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Sign in to change the widget agent",
          },
        },
        { status: 401 },
      );
    }

    const { id } = await params;
    const url = new URL(request.url);
    const domainId = url.searchParams.get("domainId");
    if (!domainId) {
      return NextResponse.json(
        { error: { code: "INVALID_INPUT", message: "Missing domainId" } },
        { status: 400 },
      );
    }

    await agentsService.setDefaultAgent(domainId, id, await headers());
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof AgentServiceError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status },
      );
    }
    console.error("POST /api/agents/[id]/default failed:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Something went wrong" } },
      { status: 500 },
    );
  }
}
