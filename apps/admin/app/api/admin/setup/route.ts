import { NextResponse } from "next/server";

import { runAdminSetup } from "@/lib/admin-setup";

export const runtime = "nodejs";
// Setup is the one moment the panel has no signed-in user yet, so it cannot
// sit behind requireAdmin(). isAdminSetupAvailable() is the real gate — once
// an admin exists this endpoint is permanently dead.
export const dynamic = "force-dynamic";

/** POST /api/admin/setup — first-run bootstrap, creates the first `owner`. */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as unknown;
    const result = await runAdminSetup(body);
    if (!result.ok) {
      const status =
        result.code === "INVALID_INPUT"
          ? 400
          : result.code === "BOOTSTRAP_FORBIDDEN"
            ? 403
            : result.code === "SETUP_ALREADY_COMPLETE"
              ? 409
              : 500;
      return NextResponse.json(result, { status });
    }
    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("POST /api/admin/setup failed:", error);
    return NextResponse.json(
      {
        ok: false,
        code: "INTERNAL",
        message: "Something went wrong. Nothing was changed.",
      },
      { status: 500 },
    );
  }
}

/** GET /api/admin/setup — is bootstrap still open? */
export async function GET() {
  try {
    const { isAdminSetupAvailable } = await import("@/lib/admin-setup");
    return NextResponse.json({ available: await isAdminSetupAvailable() });
  } catch {
    return NextResponse.json({ available: false }, { status: 500 });
  }
}