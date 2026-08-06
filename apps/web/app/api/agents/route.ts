import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { AgentServiceError } from "@repo/api/agents";
import { createAgentSchema } from "@repo/api/agents/schemas";

import { agentsService } from "@/services/agents-service";
import { authService } from "@/services/auth-service";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = await authService.getSession(await headers());
    if (!session) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Sign in to create agents" } },
        { status: 401 },
      );
    }
    const body = createAgentSchema.safeParse(await request.json());
    if (!body.success) {
      return NextResponse.json(
        { error: { code: "INVALID_INPUT", message: body.error.issues[0]?.message ?? "Invalid agent" } },
        { status: 400 },
      );
    }
    const agent = await agentsService.createAgent(body.data, await headers());
    return NextResponse.json({ agent }, { status: 201 });
  } catch (error) {
    if (error instanceof AgentServiceError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status },
      );
    }
    console.error("POST /api/agents failed:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Something went wrong" } },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  try {
    const session = await authService.getSession(await headers());
    if (!session) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Sign in to view agents" } },
        { status: 401 },
      );
    }
    const url = new URL(request.url);
    const domainId = url.searchParams.get("domainId") ?? "";
    if (!UUID_RE.test(domainId)) {
      return NextResponse.json(
        { error: { code: "INVALID_INPUT", message: "Invalid domainId" } },
        { status: 400 },
      );
    }
    const agents = await agentsService.listAgents(domainId, await headers());
    return NextResponse.json({ agents });
  } catch (error) {
    if (error instanceof AgentServiceError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status },
      );
    }
    console.error("GET /api/agents failed:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Something went wrong" } },
      { status: 500 },
    );
  }
}