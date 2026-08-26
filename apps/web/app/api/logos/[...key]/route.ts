import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

export const runtime = "nodejs";

const LOGOS_DIR = path.join(process.cwd(), ".uploads", "logos");

const MIME_BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  svg: "image/svg+xml",
};

/** Serves locally-stored onboarding logos in development (no blob token). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const { key: segments } = await params;

  if (
    !Array.isArray(segments) ||
    segments.length === 0 ||
    segments.some((segment) => segment.includes("..") || segment.includes("/") || segment.includes("\\"))
  ) {
    return NextResponse.json(
      { error: { code: "INVALID_INPUT", message: "Invalid logo path" } },
      { status: 400 },
    );
  }

  const target = path.join(LOGOS_DIR, ...segments);
  const resolved = path.resolve(target);
  if (!resolved.startsWith(path.resolve(LOGOS_DIR) + path.sep)) {
    return NextResponse.json(
      { error: { code: "INVALID_INPUT", message: "Invalid logo path" } },
      { status: 400 },
    );
  }

  try {
    const data = await readFile(resolved);
    const extension = segments[segments.length - 1]?.split(".").pop() ?? "";
    return new Response(new Uint8Array(data), {
      headers: {
        "content-type": MIME_BY_EXT[extension] ?? "application/octet-stream",
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Logo not found" } },
      { status: 404 },
    );
  }
}
