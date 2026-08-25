import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { DataSourceServiceError } from "@repo/api/datasources";

import { authService } from "@/services/auth-service";
import { dataSourcesService } from "@/services/datasources-service";
import { settingsService } from "@/services/settings-service";

export const runtime = "nodejs";

type Currency = "ghs" | "usd" | "eur" | "gbp";
const CURRENCIES: Currency[] = ["ghs", "usd", "eur", "gbp"];

export async function POST(request: Request) {
  try {
    const session = await authService.getSession(await headers());
    if (!session) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Sign in to sync products" } },
        { status: 401 },
      );
    }

    const raw = (await request.json()) as { domainId?: string };
    if (!raw.domainId) {
      return NextResponse.json(
        { error: { code: "INVALID_INPUT", message: "domainId is required" } },
        { status: 400 },
      );
    }

    // Synced products inherit the owner's default currency.
    const settings = await settingsService.getSettings(await headers());
    const requested =
      typeof request.headers.get("x-currency") === "string"
        ? (request.headers.get("x-currency") as Currency)
        : (settings.defaultCurrency as Currency);
    const currency = CURRENCIES.includes(requested) ? requested : "ghs";

    const result = await dataSourcesService.syncProducts(
      { domainId: raw.domainId, currency },
      request.headers,
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof DataSourceServiceError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status },
      );
    }
    console.error("POST /api/products/sync-database failed:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Something went wrong" } },
      { status: 500 },
    );
  }
}
