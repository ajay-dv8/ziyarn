import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { KnowledgeServiceError } from "@repo/api/knowledge";

import { authService } from "@/services/auth-service";
import { knowledgeService } from "@/services/knowledge-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = await authService.getSession(await headers());
    if (!session) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Sign in to upload a file" } },
        { status: 401 },
      );
    }
    const form = await request.formData();
    const domainId = form.get("domainId");
    const agentId = form.get("agentId");
    const file = form.get("file");
    if (typeof domainId !== "string" || typeof agentId !== "string") {
      return NextResponse.json(
        { error: { code: "INVALID_INPUT", message: "domainId and agentId are required" } },
        { status: 400 },
      );
    }
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: { code: "INVALID_INPUT", message: "A file is required" } },
        { status: 400 },
      );
    }
    const result = await knowledgeService.uploadFile(
      {
        domainId,
        agentId,
        fileName: file.name,
        fileMime: file.type,
        data: new Uint8Array(await file.arrayBuffer()),
      },
      request.headers,
    );
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof KnowledgeServiceError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status },
      );
    }
    console.error("POST /api/knowledge/upload failed:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Something went wrong" } },
      { status: 500 },
    );
  }
}