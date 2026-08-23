import { headers } from "next/headers";
import { NextResponse } from "next/server";

import {
  DataSourceServiceError,
  connectDataSourceSchema,
  listDataSourcesSchema,
  updateDataSourceTablesSchema,
  syncDataSourceSchema,
} from "@repo/api/datasources";
import { deleteDataSourceSchema } from "@repo/api/datasources/schemas";

import { authService } from "@/services/auth-service";
import { dataSourcesService } from "@/services/datasources-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const session = await authService.getSession(await headers());
    if (!session) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Sign in to view data sources" } },
        { status: 401 },
      );
    }
    const url = new URL(request.url);
    const parsed = listDataSourcesSchema.safeParse({
      domainId: url.searchParams.get("domainId") ?? "",
      agentId: url.searchParams.get("agentId") ?? "",
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "INVALID_INPUT", message: "domainId and agentId are required" } },
        { status: 400 },
      );
    }
    const sources = await dataSourcesService.list(parsed.data, request.headers);
    return NextResponse.json({ sources });
  } catch (error) {
    if (error instanceof DataSourceServiceError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status },
      );
    }
    console.error("GET /api/integrations/databases failed:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Something went wrong" } },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await authService.getSession(await headers());
    if (!session) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Sign in to connect a database" } },
        { status: 401 },
      );
    }
    const body = connectDataSourceSchema.safeParse(await request.json());
    if (!body.success) {
      return NextResponse.json(
        { error: { code: "INVALID_INPUT", message: body.error.issues[0]?.message ?? "Invalid connection" } },
        { status: 400 },
      );
    }
    const result = await dataSourcesService.connect(body.data, request.headers);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof DataSourceServiceError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status },
      );
    }
    console.error("POST /api/integrations/databases failed:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Something went wrong" } },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await authService.getSession(await headers());
    if (!session) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Sign in to update tables" } },
        { status: 401 },
      );
    }
    const body = updateDataSourceTablesSchema.safeParse(await request.json());
    if (!body.success) {
      return NextResponse.json(
        { error: { code: "INVALID_INPUT", message: body.error.issues[0]?.message ?? "Invalid selection" } },
        { status: 400 },
      );
    }
    await dataSourcesService.updateTables(body.data, request.headers);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof DataSourceServiceError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status },
      );
    }
    console.error("PATCH /api/integrations/databases failed:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Something went wrong" } },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const session = await authService.getSession(await headers());
    if (!session) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Sign in to sync data" } },
        { status: 401 },
      );
    }
    const parsed = syncDataSourceSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "INVALID_INPUT", message: "domainId and dataSourceId are required" } },
        { status: 400 },
      );
    }
    const result = await dataSourcesService.sync(parsed.data, request.headers);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof DataSourceServiceError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status },
      );
    }
    console.error("PUT /api/integrations/databases failed:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Something went wrong" } },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await authService.getSession(await headers());
    if (!session) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Sign in to disconnect" } },
        { status: 401 },
      );
    }
    const url = new URL(request.url);
    const domainId = url.searchParams.get("domainId") ?? "";
    const dataSourceId = url.searchParams.get("dataSourceId") ?? "";
    const parsed = deleteDataSourceSchema.safeParse({ domainId, dataSourceId });
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "INVALID_INPUT", message: "domainId and dataSourceId are required" } },
        { status: 400 },
      );
    }
    await dataSourcesService.remove(parsed.data, request.headers);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof DataSourceServiceError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status },
      );
    }
    console.error("DELETE /api/integrations/databases failed:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Something went wrong" } },
      { status: 500 },
    );
  }
}
