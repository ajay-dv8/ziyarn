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
  transferWorkspaceOwnershipSchema,
  type AssignableWorkspaceRole,
  type WorkspaceRole,
} from "@repo/api/workspaces";

import { APP_ROUTES } from "@/constants/routes";
import { sendWorkspaceInviteEmail } from "@/lib/workspace-invite-email";
import { workspaceService } from "@/services/workspace-service";

export type WorkspaceActionResult =
  | { ok: true; workspaceId?: string; inviteUrl?: string; emailed?: boolean }
  | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> };

/** Every mutation on the workspace page revalidates the same path and reports
 * failures in the same shape. */
function revalidateWorkspace() {
  revalidatePath(APP_ROUTES.DASHBOARD_WORKSPACES);
}

function errorResult(error: unknown): Extract<WorkspaceActionResult, { ok: false }> {
  if (
    error instanceof WorkspaceServiceError ||
    error instanceof PlanLimitError
  ) {
    return { ok: false, error: error.message };
  }
  console.error("Unexpected workspace action error:", error);
  return { ok: false, error: "Something went wrong, please try again" };
}

/** Creates a workspace with the caller as its owner. Plan limits apply. */
export async function createWorkspaceAction(input: {
  name: string;
}): Promise<WorkspaceActionResult> {
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
    revalidateWorkspace();
    return { ok: true, workspaceId: workspace.id };
  } catch (error) {
    return errorResult(error);
  }
}

/** Renames a workspace. Owners and admins may. */
export async function renameWorkspaceAction(input: {
  workspaceId: string;
  name: string;
}): Promise<WorkspaceActionResult> {
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
    revalidateWorkspace();
    return { ok: true, workspaceId: input.workspaceId };
  } catch (error) {
    return errorResult(error);
  }
}

/**
 * Deletes a workspace and everyone's access to it. The caller is left signed in
 * with whatever workspaces they still belong to, so the page must be re-read
 * rather than assumed — hence no workspaceId in the result.
 */
export async function deleteWorkspaceAction(input: {
  workspaceId: string;
}): Promise<WorkspaceActionResult> {
  try {
    await workspaceService.deleteWorkspace(input.workspaceId, await headers());
    revalidateWorkspace();
    return { ok: true };
  } catch (error) {
    return errorResult(error);
  }
}

/** Invites anyone by email to a workspace. Delivery is best-effort: when SMTP
 * is not configured the invite still exists and the caller gets its link back
 * to share by hand. */
export async function inviteWorkspaceMemberAction(input: {
  workspaceId: string;
  email: string;
  role: AssignableWorkspaceRole;
}): Promise<WorkspaceActionResult> {
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

    revalidateWorkspace();
    return {
      ok: true,
      workspaceId: input.workspaceId,
      inviteUrl: result.inviteUrl,
      emailed: delivery.emailed,
    };
  } catch (error) {
    return errorResult(error);
  }
}

/** Changes a workspace member's role. Owners are rejected by the service. */
export async function updateWorkspaceMemberRoleAction(input: {
  workspaceId: string;
  memberId: string;
  role: AssignableWorkspaceRole;
}): Promise<WorkspaceActionResult> {
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
    revalidateWorkspace();
    return { ok: true };
  } catch (error) {
    return errorResult(error);
  }
}

/** Hands workspace ownership to another admin/member. */
export async function transferWorkspaceOwnershipAction(input: {
  workspaceId: string;
  memberId: string;
}): Promise<WorkspaceActionResult> {
  const parsed = transferWorkspaceOwnershipSchema.safeParse({
    memberId: input.memberId,
  });
  if (!parsed.success) {
    return { ok: false, error: "That member is not valid" };
  }

  try {
    await workspaceService.transferOwnership(
      input.workspaceId,
      parsed.data,
      await headers(),
    );
    revalidateWorkspace();
    revalidatePath(APP_ROUTES.DASHBOARD_TEAM);
    return { ok: true, workspaceId: input.workspaceId };
  } catch (error) {
    return errorResult(error);
  }
}

/** Removes a member from a workspace. */
export async function removeWorkspaceMemberAction(input: {
  workspaceId: string;
  memberId: string;
}): Promise<WorkspaceActionResult> {
  try {
    await workspaceService.removeMember(
      input.workspaceId,
      input.memberId,
      await headers(),
    );
    revalidateWorkspace();
    return { ok: true };
  } catch (error) {
    return errorResult(error);
  }
}

/** Cancels a pending workspace invite and frees its seat. */
export async function revokeWorkspaceInviteAction(input: {
  workspaceId: string;
  inviteId: string;
}): Promise<WorkspaceActionResult> {
  try {
    await workspaceService.revokeInvite(
      input.workspaceId,
      input.inviteId,
      await headers(),
    );
    revalidateWorkspace();
    return { ok: true };
  } catch (error) {
    return errorResult(error);
  }
}

/**
 * How many workspaces the signed-in user may still create, for the create form
 * to disable itself instead of failing on submit.
 */
