"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { PlanLimitError } from "@repo/api/plans";
import {
  WorkspaceServiceError,
  createWorkspaceSchema,
  inviteMemberSchema,
  renameWorkspaceSchema,
  updateMemberRoleSchema,
  type AssignableWorkspaceRole,
  type WorkspaceRole,
} from "@repo/api/workspaces";

import { APP_ROUTES } from "@/constants/routes";
import { sendWorkspaceInviteEmail } from "@/lib/workspace-invite-email";
import { workspaceService } from "@/services/workspace-service";

export type TeamActionResult =
  | { ok: true; workspaceId?: string; inviteUrl?: string; emailed?: boolean }
  | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> };

/** Every mutation on the team page revalidates the same path and reports
 * failures in the same shape. */
function revalidateTeam() {
  revalidatePath(APP_ROUTES.DASHBOARD_TEAM);
}

function errorResult(error: unknown): Extract<TeamActionResult, { ok: false }> {
  if (
    error instanceof WorkspaceServiceError ||
    error instanceof PlanLimitError
  ) {
    return { ok: false, error: error.message };
  }
  console.error("Unexpected team action error:", error);
  return { ok: false, error: "Something went wrong, please try again" };
}

/** Creates a team (workspace) with the caller as its owner. */
export async function createTeamAction(input: {
  name: string;
}): Promise<TeamActionResult> {
  const parsed = createWorkspaceSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const workspace = await workspaceService.createWorkspace(
      parsed.data,
      await headers(),
    );
    revalidateTeam();
    return { ok: true, workspaceId: workspace.id };
  } catch (error) {
    return errorResult(error);
  }
}

/** Renames a team. Owners and admins may. */
export async function renameTeamAction(input: {
  workspaceId: string;
  name: string;
}): Promise<TeamActionResult> {
  const parsed = renameWorkspaceSchema.safeParse({ name: input.name });
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await workspaceService.updateWorkspace(
      input.workspaceId,
      parsed.data,
      await headers(),
    );
    revalidateTeam();
    return { ok: true, workspaceId: input.workspaceId };
  } catch (error) {
    return errorResult(error);
  }
}

/**
 * Deletes a team and everyone's access to it. The caller is left signed in
 * with whatever teams they still belong to, so the page must be re-read rather
 * than assumed — hence no workspaceId in the result.
 */
export async function deleteTeamAction(input: {
  workspaceId: string;
}): Promise<TeamActionResult> {
  try {
    await workspaceService.deleteWorkspace(input.workspaceId, await headers());
    revalidateTeam();
    return { ok: true };
  } catch (error) {
    return errorResult(error);
  }
}

/** Invites anyone by email. Delivery is best-effort: when SMTP is not
 * configured the invite still exists and the caller gets its link back to
 * share by hand. */
export async function inviteMemberAction(input: {
  workspaceId: string;
  email: string;
  role: AssignableWorkspaceRole;
}): Promise<TeamActionResult> {
  const parsed = inviteMemberSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Enter a valid email address",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const result = await workspaceService.inviteMember(
      input.workspaceId,
      parsed.data,
      await headers(),
    );

    const delivery = await sendWorkspaceInviteEmail({
      to: result.invite.email,
      workspaceName: result.workspace.name,
      role: result.invite.role as WorkspaceRole,
      inviteUrl: result.inviteUrl,
      expiresAt: result.invite.expiresAt,
    });

    revalidateTeam();
    return {
      ok: true,
      workspaceId: input.workspaceId,
      inviteUrl: result.inviteUrl,
      emailed: delivery.emailed,
    };  } catch (error) {
    return errorResult(error);
  }
}

/** Changes a member's role. Owners are rejected by the service. */
export async function updateMemberRoleAction(input: {
  workspaceId: string;
  memberId: string;
  role: AssignableWorkspaceRole;
}): Promise<TeamActionResult> {
  const parsed = updateMemberRoleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "That role is not valid" };
  }

  try {
    await workspaceService.updateMemberRole(
      input.workspaceId,
      parsed.data,
      await headers(),
    );
    revalidateTeam();
    return { ok: true };
  } catch (error) {
    return errorResult(error);
  }
}

/** Removes a member from the team. */
export async function removeMemberAction(input: {
  workspaceId: string;
  memberId: string;
}): Promise<TeamActionResult> {
  try {
    await workspaceService.removeMember(
      input.workspaceId,
      input.memberId,
      await headers(),
    );
    revalidateTeam();
    return { ok: true };
  } catch (error) {
    return errorResult(error);
  }
}

/** Cancels a pending invite and frees its seat. */
export async function revokeInviteAction(input: {
  workspaceId: string;
  inviteId: string;
}): Promise<TeamActionResult> {
  try {
    await workspaceService.revokeInvite(
      input.workspaceId,
      input.inviteId,
      await headers(),
    );
    revalidateTeam();
    return { ok: true };
  } catch (error) {
    return errorResult(error);
  }
}

/**
 * How many teams the signed-in user may still create, for the create form to
 * disable itself instead of failing on submit.
 */
