import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { isCloudinaryConfigured, uploadCloudinaryImage } from "@repo/media/server";

import { API_ROUTES } from "@/constants/routes";
import { authService } from "@/services/auth-service";

export const runtime = "nodejs";

const MAX_BYTES = 2 * 1024 * 1024;

const ALLOWED: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

const LOGOS_DIR = path.join(process.cwd(), ".uploads", "logos");

export async function POST(request: Request) {
  try {
    const session = await authService.getSession(await headers());
    if (!session) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Sign in to upload a logo" } },
        { status: 401 },
      );
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: { code: "INVALID_INPUT", message: "A logo file is required" } },
        { status: 400 },
      );
    }
    const extension = ALLOWED[file.type];
    if (!extension) {
      return NextResponse.json(
        { error: { code: "UNSUPPORTED_TYPE", message: "Logo must be PNG, JPG, WebP or SVG" } },
        { status: 415 },
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: { code: "TOO_LARGE", message: "Logo must be 2 MB or smaller" } },
        { status: 413 },
      );
    }

    const data = Buffer.from(await file.arrayBuffer());
    const uploadId = randomUUID();
    const key = `${session.user.id}/${uploadId}.${extension}`;

    if (isCloudinaryConfigured()) {
      const result = await uploadCloudinaryImage({
        data,
        mimeType: file.type,
        fileName: `logo.${extension}`,
        folder: `ziyarn/logos/${session.user.id}`,
        publicId: uploadId,
      });
      return NextResponse.json({ url: result.secureUrl });
    }

    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const { put } = await import("@vercel/blob");
      const result = await put(`logos/${key}`, data, {
        access: "public",
        allowOverwrite: true,
      });
      return NextResponse.json({ url: result.url });
    }

    // Local development fallback — served back through /api/logos/[...key].
    const target = path.join(LOGOS_DIR, key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, data);
    return NextResponse.json({ url: API_ROUTES.logos(key) });
  } catch (error) {
    console.error("POST /api/uploads/logo failed:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Something went wrong" } },
      { status: 500 },
    );
  }
}
