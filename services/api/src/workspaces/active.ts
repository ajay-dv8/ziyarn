import { eq } from "drizzle-orm";

import type { Database } from "@repo/database";
import { workspaceMembers } from "@repo/database/schema/workspaces";

import {
  pickActiveWorkspaceId,
  readActiveWorkspaceCookie,
} from "@repo/api/workspaces/active-cookie";

/**
 * The workspace the dashboard should show. The cookie only expresses intent:
 * a workspace the user is not a member of is ignored, and the user's
 * first-joined workspace is used instead.
 */
export async function resolveActiveWorkspaceId(
  db: Database,
  headers: Headers,
  userId: string,
): Promise<string | null> {
  const memberships = await db
    .select({ workspaceId: workspaceMembers.workspaceId })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.userId, userId))
    .orderBy(workspaceMembers.createdAt);

  return pickActiveWorkspaceId(
    memberships.map((membership) => membership.workspaceId),
    readActiveWorkspaceCookie(headers),
  );
}
