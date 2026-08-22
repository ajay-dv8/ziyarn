import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { SettingsServiceError } from "@repo/api/settings";

import { settingsService } from "@/services/settings-service";

export const runtime = "nodejs";

export async function GET() {
  try {
    const settings = await settingsService.getSettings(await headers());
    return NextResponse.json(settings);
  } catch (error) {
    if (error instanceof SettingsServiceError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status },
      );
    }
    console.error("GET /api/settings failed:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Something went wrong" } },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { name, defaultCurrency } = body as {
      name?: string;
      defaultCurrency?: string;
    };

    if (name !== undefined) {
      await settingsService.updateProfile({ name }, await headers());
    }
    if (defaultCurrency !== undefined) {
      await settingsService.updateDefaultCurrency(
        { defaultCurrency },
        await headers(),
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof SettingsServiceError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status },
      );
    }
    console.error("PATCH /api/settings failed:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Something went wrong" } },
      { status: 500 },
    );
  }
}
