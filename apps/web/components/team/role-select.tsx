"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  ASSIGNABLE_WORKSPACE_ROLES,
  WORKSPACE_ROLE_DESCRIPTIONS,
  WORKSPACE_ROLE_LABELS,
  type AssignableWorkspaceRole,
  type WorkspaceRole,
} from "@repo/api/workspaces/roles";
import { toast } from "sonner";

import { updateMemberRoleAction } from "@/lib/actions/workspaces";

/**
 * Role picker for one member. The owner row renders a static label instead:
 * a workspace has exactly one owner and the service refuses to change it, so
 * offering the control would be offering a lie.
 */
export function RoleSelect({
  workspaceId,
  memberId,
  role,
  disabled,
}: {
  workspaceId: string;
  memberId: string;
  role: WorkspaceRole;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  if (role === "owner") {
    return (
      <span className="text-sm text-muted-foreground">
        {WORKSPACE_ROLE_LABELS.owner}
      </span>
    );
  }

  const onChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextRole = event.target.value as AssignableWorkspaceRole;
    setPending(true);
    const result = await updateMemberRoleAction({
      workspaceId,
      memberId,
      role: nextRole,
    });
    setPending(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(`Role changed to ${WORKSPACE_ROLE_LABELS[nextRole]}`);
    router.refresh();
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <select
        value={role}
        onChange={onChange}
        disabled={disabled || pending}
        aria-label="Member role"
        className="h-8 rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
      >
        {ASSIGNABLE_WORKSPACE_ROLES.map((assignableRole) => (
          <option key={assignableRole} value={assignableRole}>
            {WORKSPACE_ROLE_LABELS[assignableRole]}
          </option>
        ))}
      </select>
      <p className="text-xs text-muted-foreground">
        {WORKSPACE_ROLE_DESCRIPTIONS[role as AssignableWorkspaceRole] ??
          WORKSPACE_ROLE_DESCRIPTIONS.member}
      </p>
    </div>
  );
}
