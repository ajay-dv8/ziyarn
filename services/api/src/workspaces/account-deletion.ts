import { and, eq, inArray } from "drizzle-orm";

import type { Database } from "@repo/database";
import { subscriptions } from "@repo/database/schema/billing";
import {
  teamMembers,
  teams,
  workspaces,
} from "@repo/database/schema/workspaces";

/** Account deletion is refused while shared workspace data depends on it. */
export class AccountDeletionBlockedError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AccountDeletionBlockedError";
  }
}

const ACTIVE_SUBSCRIPTION_STATUSES = ["active", "trialing", "past_due"] as const;

function formatWorkspaceNames(names: string[]): string {
  const shown = names.slice(0, 3).join(", ");
  return names.length > 3 ? `${shown}, and ${names.length - 3} more` : shown;
}

/**
 * Teams are shared workspace data, but `teams.ownerId` cascades on user delete.
 * Hand any team the leaving user owns to the workspace owner before the user
 * row is removed, mirroring what removing a member already does.
 */
async function reassignOwnedTeams(db: Database, userId: string): Promise<void> {
  const ownedTeams = await db
    .select({ id: teams.id, workspaceId: teams.workspaceId })
    .from(teams)
    .where(eq(teams.ownerId, userId));

  for (const team of ownedTeams) {
    const [workspace] = await db
      .select({ ownerId: workspaces.ownerId })
      .from(workspaces)
      .where(eq(workspaces.id, team.workspaceId))
      .limit(1);
    if (!workspace) continue;
    if (workspace.ownerId === userId) {
      throw new AccountDeletionBlockedError(
        "ACCOUNT_DELETION_BLOCKED",
        "Transfer ownership of your workspaces before deleting your account.",
      );
    }

    // Add the workspace owner to the team before moving ownership. If the
    // second write fails, deletion is refused and a retry finishes the job
    // without leaving the team owned by someone with no team membership.
    await db
      .insert(teamMembers)
      .values({
        teamId: team.id,
        userId: workspace.ownerId,
        role: "owner",
      })
      .onConflictDoUpdate({
        target: [teamMembers.teamId, teamMembers.userId],
        set: { role: "owner" },
      });

    await db
      .update(teams)
      .set({ ownerId: workspace.ownerId, updatedAt: new Date() })
      .where(eq(teams.id, team.id));
  }
}

/**
 * Better Auth calls this before deleting a user. It blocks deletion while the
 * user owns shared data or has an active subscription, then moves owned teams
 * to their workspace owner. A database `RESTRICT` on `workspaces.owner_id` is
 * still the final guard if a check is bypassed.
 */
export async function prepareAccountDeletion(
  db: Database,
  userId: string,
): Promise<void> {
  const [ownedWorkspaces, activeSubscriptions] = await Promise.all([
    db
      .select({ name: workspaces.name })
      .from(workspaces)
      .where(eq(workspaces.ownerId, userId)),
    db
      .select({ id: subscriptions.id })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.ownerId, userId),
          inArray(subscriptions.status, ACTIVE_SUBSCRIPTION_STATUSES),
        ),
      )
      .limit(1),
  ]);

  const blockers: string[] = [];
  if (ownedWorkspaces.length > 0) {
    blockers.push(
      `Transfer ownership of ${formatWorkspaceNames(
        ownedWorkspaces.map((workspace) => workspace.name),
      )} before deleting your account.`,
    );
  }
  if (activeSubscriptions.length > 0) {
    blockers.push("Cancel your subscription before deleting your account.");
  }

  if (blockers.length > 0) {
    throw new AccountDeletionBlockedError(
      "ACCOUNT_DELETION_BLOCKED",
      blockers.join(" "),
    );
  }

  await reassignOwnedTeams(db, userId);
}
