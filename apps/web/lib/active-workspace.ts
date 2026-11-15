import { ACTIVE_WORKSPACE_COOKIE } from "@repo/api/workspaces/active-cookie";

/**
 * Remembers the workspace pick. The server validates membership before using
 * it, so a stale or forged value falls back to the user's first workspace.
 */
export function setActiveWorkspaceCookie(workspaceId: string) {
  document.cookie = `${ACTIVE_WORKSPACE_COOKIE}=${encodeURIComponent(
    workspaceId,
  )}; path=/; max-age=31536000; samesite=lax`;
}
