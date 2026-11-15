import { eq, inArray } from "drizzle-orm";

import type { Database } from "@repo/database";
import { domains } from "@repo/database/schema/domains";
import { workspaceMembers } from "@repo/database/schema/workspaces";
import { highestPlan, type Plan } from "@repo/api/plans";

/**
 * The plan a workspace's limits are read from: the highest plan among the
 * domains owned by anyone in it. A workspace with no domains yet is "free",
 * which is what an owner sees before their first domain exists.
 */
export async function resolveWorkspacePlan(
  db: Database,
  workspaceId: string,
): Promise<Plan> {
  // Two queries rather than a sub-select: passing a drizzle sub-query to
  // inArray() serialises as "[object Object]" on this driver.
  const memberRows = await db
    .select({ userId: workspaceMembers.userId })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.workspaceId, workspaceId));

  const memberUserIds = memberRows.map((row) => row.userId);
  if (memberUserIds.length === 0) return "free";

  const ownedDomains = await db
    .select({ plan: domains.plan })
    .from(domains)
    .where(inArray(domains.ownerId, memberUserIds));

  return highestPlan(ownedDomains.map((row) => row.plan));
}
