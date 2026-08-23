import { headers } from "next/headers";
import { NextResponse, after } from "next/server";

import { KnowledgeServiceError } from "@repo/api/knowledge";
import {
  crawlStatusSchema,
  startCrawlSchema,
} from "@repo/api/knowledge/schemas";

import { authService } from "@/services/auth-service";
import { knowledgeService } from "@/services/knowledge-service";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const session = await authService.getSession(await headers());
    if (!session) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Sign in to crawl a website" } },
        { status: 401 },
      );
    }
    const body = startCrawlSchema.safeParse(await request.json());
    if (!body.success) {
      return NextResponse.json(
        { error: { code: "INVALID_INPUT", message: body.error.issues[0]?.message ?? "Invalid crawl request" } },
        { status: 400 },
      );
    }
    const { job, run } = await knowledgeService.startCrawl(
      body.data,
      request.headers,
    );
    // The crawl runs after the response is sent; the client polls GET below.
    after(async () => {
      try {
        await run();
      } catch (error) {
        console.error("Background crawl failed:", error);
      }
    });
    return NextResponse.json({ crawlJob: job }, { status: 201 });
  } catch (error) {
    if (error instanceof KnowledgeServiceError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status },
      );
    }
    console.error("POST /api/knowledge/crawl failed:", error);
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
        { error: { code: "UNAUTHORIZED", message: "Sign in to view crawl status" } },
        { status: 401 },
      );
    }
    const url = new URL(request.url);
    const parsed = crawlStatusSchema.safeParse({
      domainId: url.searchParams.get("domainId") ?? "",
      agentId: url.searchParams.get("agentId") ?? "",
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "INVALID_INPUT", message: "domainId and agentId are required" } },
        { status: 400 },
      );
    }
    const status = await knowledgeService.getCrawlStatus(
      parsed.data,
      request.headers,
    );
    return NextResponse.json(status);
  } catch (error) {
    if (error instanceof KnowledgeServiceError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status },
      );
    }
    console.error("GET /api/knowledge/crawl failed:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Something went wrong" } },
      { status: 500 },
    );
  }
}
