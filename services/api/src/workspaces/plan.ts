import { eq, inArray } from "drizzle-orm";

import type { Database } from "@repo/database";
import { domains } from "@repo/database/schema/domains";
import { subscriptions } from "@repo/database/schema/billing";
import { workspaces } from "@repo/database/schema/workspaces";
import { planSchema, type Plan } from "@repo/api/plans";

/**
 * Statuses where the paid plan is still in force. `past_due` keeps the plan
 * during the payment-retry window, matching the webhook behaviour; a canceled
 * or incomplete subscription falls back to free.
 */
const PAID_SUBSCRIPTION_STATUSES = new Set([
  "active",
  "trialing",
  "past_due",
]);

function planForSubscription(
  subscription: { plan: string; status: string } | null,
): Plan {
  if (!subscription || !PAID_SUBSCRIPTION_STATUSES.has(subscription.status)) {
    return "free";
  }
  return planSchema.parse(subscription.plan);
}

/**
 * The plan a workspace's limits are read from: the active subscription of the
 * workspace owner. A plan is account-level and covers every workspace that
 * account owns; members' plans never raise another workspace's limits.
 */
export async function resolveWorkspacePlan(
  db: Database,
  workspaceId: string,
): Promise<Plan> {
  const [workspace] = await db
    .select({ ownerId: workspaces.ownerId })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);
  if (!workspace) return "free";

  const [subscription] = await db
    .select({ plan: subscriptions.plan, status: subscriptions.status })
    .from(subscriptions)
    .where(eq(subscriptions.ownerId, workspace.ownerId))
    .limit(1);

  return planForSubscription(subscription ?? null);
}

/** The plan a user's own subscription grants, used for workspace limits. */
export async function resolveUserPlan(
  db: Database,
  userId: string,
): Promise<Plan> {
  const [subscription] = await db
    .select({ plan: subscriptions.plan, status: subscriptions.status })
    .from(subscriptions)
    .where(eq(subscriptions.ownerId, userId))
    .limit(1);

  return planForSubscription(subscription ?? null);
}

/**
 * Applies a plan to every domain in the workspaces the subscriber owns,
 * including domains created by invited members. Two queries because the
 * neon-http driver serialises a drizzle sub-query passed to inArray() as
 * "[object Object]".
 */
export async function applyPlanToOwnedWorkspaces(
  db: Database,
  ownerId: string,
  plan: Plan,
): Promise<void> {
  const ownedWorkspaces = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.ownerId, ownerId));

  const workspaceIds = ownedWorkspaces.map((workspace) => workspace.id);
  if (workspaceIds.length === 0) return;

  await db
    .update(domains)
    .set({ plan, updatedAt: new Date() })
    .where(inArray(domains.workspaceId, workspaceIds));
}
