import type { WorkspaceRole } from "@repo/api/workspaces/roles";

import { workspaceService } from "@/services/workspace-service";

/** Roles allowed to create or change shared workspace data. */
export const WORKSPACE_EDITOR_ROLES: readonly WorkspaceRole[] = [
  "owner",
  "admin",
  "member",
];

/** Billing follows the account that owns the workspace. */
export const WORKSPACE_OWNER_ROLES: readonly WorkspaceRole[] = ["owner"];

export type ActiveWorkspaceAccess =
  | { ok: true; workspaceId: string; role: WorkspaceRole }
  | {
      ok: false;
      status: 403 | 404;
      code: "NO_ACTIVE_WORKSPACE" | "FORBIDDEN";
      message: string;
    };

/**
 * Resolves the active workspace and checks the caller's role. Shared by route
 * handlers so a viewer can never reach a mutation through a missing check.
 */
export async function getActiveWorkspaceAccess(
  requestHeaders: Headers,
  allowedRoles?: readonly WorkspaceRole[],
): Promise<ActiveWorkspaceAccess> {
  const workspaceId =
    await workspaceService.getActiveWorkspaceId(requestHeaders);
  if (!workspaceId) {
    return {
      ok: false,
      status: 404,
      code: "NO_ACTIVE_WORKSPACE",
      message: "Select a workspace first",
    };
  }

  const workspace = await workspaceService.getWorkspace(
    workspaceId,
    requestHeaders,
  );
  if (allowedRoles && !allowedRoles.includes(workspace.role)) {
    return {
      ok: false,
      status: 403,
      code: "FORBIDDEN",
      message: "Your workspace role does not allow this action",
    };
  }

  return { ok: true, workspaceId, role: workspace.role };
}
