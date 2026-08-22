import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { SettingsServiceError } from "@repo/api/settings";

import { settingsService } from "@/services/settings-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { currentPassword, newPassword } = (await request.json()) as {
      currentPassword?: string;
      newPassword?: string;
    };
    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_INPUT",
            message: "Current and new passwords are required",
          },
        },
        { status: 400 },
      );
    }
    await settingsService.changePassword(
      { currentPassword, newPassword },
      await headers(),
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof SettingsServiceError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.status },
      );
    }
    console.error("POST /api/settings/password failed:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Something went wrong" } },
      { status: 500 },
    );
  }
}
