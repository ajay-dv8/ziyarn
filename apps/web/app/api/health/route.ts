import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@repo/database";

/**
 * Public health check for uptime monitors.
 *
 * It only proves the web process can reach the database. It deliberately does
 * not call AI providers, email, or Paystack: those are checked by their own
 * failure paths, and a health check must stay cheap and fast.
 */

const DATABASE_TIMEOUT_MS = 3_000;

async function checkDatabase(): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    await Promise.race([
      db.execute(sql`select 1`),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error("Database health check timed out")),
          DATABASE_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function GET() {
  const headers = { "cache-control": "no-store" };

  try {
    await checkDatabase();
    return NextResponse.json(
      {
        status: "ok",
        database: "ok",
        version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "development",
        timestamp: new Date().toISOString(),
      },
      { headers },
    );
  } catch {
    return NextResponse.json(
      { status: "degraded", database: "error" },
      { status: 503, headers },
    );
  }
}
