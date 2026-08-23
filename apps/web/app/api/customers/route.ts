import { headers } from "next/headers";
import { NextResponse } from "next/server";

import {
  CustomersServiceError,
  backfillCustomersSchema,
  importCustomersSchema,
} from "@repo/api/customers";
import { listCustomersSchema } from "@repo/api/customers/schemas";

import { authService } from "@/services/auth-service";
import { customersService } from "@/services/customers-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const session = await authService.getSession(await headers());
    if (!session) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Sign in to view customers" } },
        { status: 401 },
      );
    }
    const url = new URL(request.url);
    const parsed = listCustomersSchema.safeParse({
      domainId: url.searchParams.get("domainId") ?? "",
      source: url.searchParams.get("source") || undefined,
      q: url.searchParams.get("q") || undefined,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "INVALID_INPUT", message: "domainId is required" } },
        { status: 400 },
      );
    }
    const result = await customersService.list(parsed.data, request.headers);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof CustomersServiceError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status },
      );
    }
    console.error("GET /api/customers failed:", error);
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
        { error: { code: "UNAUTHORIZED", message: "Sign in to manage customers" } },
        { status: 401 },
      );
    }
    const raw = (await request.json()) as Record<string, unknown>;
    const action = typeof raw.action === "string" ? raw.action : "";

    if (action === "backfill") {
      const parsed = backfillCustomersSchema.safeParse({
        domainId: raw.domainId,
      });
      if (!parsed.success) {
        return NextResponse.json(
          { error: { code: "INVALID_INPUT", message: "domainId is required" } },
          { status: 400 },
        );
      }
      const result = await customersService.backfillFromLeads(
        parsed.data,
        request.headers,
      );
      return NextResponse.json(result);
    }

    const parsed = importCustomersSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "INVALID_INPUT", message: parsed.error.issues[0]?.message ?? "Invalid rows" } },
        { status: 400 },
      );
    }
    const result = await customersService.import(parsed.data, request.headers);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof CustomersServiceError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status },
      );
    }
    console.error("POST /api/customers failed:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Something went wrong" } },
      { status: 500 },
    );
  }
}
