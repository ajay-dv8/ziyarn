/** Cookie that remembers which workspace the dashboard is showing. */
export const ACTIVE_WORKSPACE_COOKIE = "ziyarn_active_workspace";

/**
 * Reads the active workspace id from a raw Cookie header. Malformed encoding
 * is treated as absent: a bad cookie must never break a page render.
 */
export function readActiveWorkspaceCookie(headers: Headers): string | null {
  const cookieHeader = headers.get("cookie");
  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;

    const name = part.slice(0, separator).trim();
    if (name !== ACTIVE_WORKSPACE_COOKIE) continue;

    try {
      return decodeURIComponent(part.slice(separator + 1).trim()) || null;
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * The requested workspace when the user belongs to it, otherwise their first
 * one. One rule, shared by the header and the domain list, so the workspace
 * shown and the workspace queried cannot disagree.
 */
export function pickActiveWorkspaceId(
  workspaceIds: string[],
  requested: string | null,
): string | null {
  if (requested && workspaceIds.includes(requested)) return requested;
  return workspaceIds[0] ?? null;
}
