import { type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

async function getHandler() {
  const { auth } = await import("@/lib/auth");
  const { toNextJsHandler } = await import("better-auth/next-js");
  return toNextJsHandler(auth);
}

export async function GET(request: NextRequest) {
  const handler = await getHandler();
  return handler.GET(request);
}

export async function POST(request: NextRequest) {
  const handler = await getHandler();
  return handler.POST(request);
}
