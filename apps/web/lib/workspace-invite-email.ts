import { sendTransactional, workspaceInviteTemplate } from "@repo/api/email";
import { WORKSPACE_ROLE_LABELS, type WorkspaceRole } from "@repo/api/workspaces";

/**
 * Sends a team invite. Shared by every path that can create an invite — the
 * dashboard action and the REST route — so a programmatic invite reaches the
 * recipient exactly like one made from the UI.
 *
 * Best-effort by design: SMTP is optional on a self-hosted deployment, and a
 * failed send must not undo an invite the owner can still share by hand. The
 * caller keeps the returned link either way.
 */
export async function sendWorkspaceInviteEmail(input: {
  to: string;
  workspaceName: string;
  role: WorkspaceRole;
  inviteUrl: string;
  expiresAt: Date;
}): Promise<{ emailed: boolean }> {
  const message = workspaceInviteTemplate({
    workspaceName: input.workspaceName,
    roleLabel: WORKSPACE_ROLE_LABELS[input.role] ?? input.role,
    inviteUrl: input.inviteUrl,
    expiresAt: input.expiresAt.toISOString(),
  });

  const result = await sendTransactional({ to: input.to, ...message });
  return { emailed: result.ok };
}
