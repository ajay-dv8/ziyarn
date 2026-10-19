import { getSessionCookie } from "better-auth/cookies";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { APP_ROUTES } from "@/constants/routes";

export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    return NextResponse.redirect(new URL(APP_ROUTES.SIGN_IN, request.url));
  }
  return NextResponse.next();
}

export const config = {
  // This must stay a literal. Next reads it with a static AST pass
  // (`extractExportedConstValue`), not by running this file, so pointing it at
  // APP_ROUTES.DASHBOARD would fail with: Unsupported template literal with
  // expressions (or `Unsupported node type "Identifier"` for the bare import).
  matcher: ["/dashboard/:path*"],
};
