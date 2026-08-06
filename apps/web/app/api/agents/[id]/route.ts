import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { AgentServiceError } from "@repo/api/agents";
import { updateAgentSchema } from "@repo/api/agents/schemas";

import { agentsService } from "@/services/agents-service";
import { authService } from "@/services/auth-service";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await authService.getSession(await headers());
    if (!session) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Sign in to update agents" } },
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
    const body = updateAgentSchema.safeParse(await request.json());
    if (!body.success) {
      return NextResponse.json(
        { error: { code: "INVALID_INPUT", message: body.error.issues[0]?.message ?? "Invalid agent" } },
        { status: 400 },
      );
    }
    const agent = await agentsService.updateAgent(
      domainId,
      id,
      body.data,
      await headers(),
    );
    return NextResponse.json({ agent });
  } catch (error) {
    if (error instanceof AgentServiceError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status },
      );
    }
    console.error("PATCH /api/agents/[id] failed:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Something went wrong" } },
      { status: 500 },
    );
  }
}