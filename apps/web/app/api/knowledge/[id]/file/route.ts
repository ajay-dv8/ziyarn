import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { KnowledgeServiceError } from "@repo/api/knowledge";

import { authService } from "@/services/auth-service";
import { knowledgeService } from "@/services/knowledge-service";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await authService.getSession(await headers());
    if (!session) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Sign in to download a file" } },
        { status: 401 },
      );
    }
    const { id } = await params;
    const url = new URL(request.url);
    const domainId = url.searchParams.get("domainId");
    if (!domainId) {
      return NextResponse.json(
        { error: { code: "INVALID_INPUT", message: "domainId is required" } },
        { status: 400 },
      );
    }
    const { data, fileName, fileMime } = await knowledgeService.getFile(
      { domainId, documentId: id },
      request.headers,
    );
    return new NextResponse(Buffer.from(data), {
      status: 200,
      headers: {
        "Content-Type": fileMime,
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      },
    });
  } catch (error) {
    if (error instanceof KnowledgeServiceError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status },
      );
    }
    console.error("GET /api/knowledge/[id]/file failed:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Something went wrong" } },
      { status: 500 },
    );
  }
}