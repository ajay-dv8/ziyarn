"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { WORKSPACE_ROLE_LABELS, type WorkspaceRole } from "@repo/api/workspaces/roles";
import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { toast } from "sonner";

import { CopyLinkButton } from "@/components/team/copy-link-button";
import { revokeInviteAction } from "@/lib/actions/workspaces";

export type TeamInvite = {
  inviteId: string;
  email: string;
  role: WorkspaceRole;
  /** Absolute accept link, built server-side so it works before hydration. */
  inviteUrl: string;
  expiresAt: string;
};

export function PendingInviteList({
  workspaceId,
  invites,
  canManage,
}: {
  workspaceId: string;
  invites: TeamInvite[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const revoke = async (inviteId: string) => {
    setRevokingId(inviteId);
    const result = await revokeInviteAction({ workspaceId, inviteId });
    setRevokingId(null);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success("Invite revoked");
    router.refresh();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pending invites</CardTitle>
        <CardDescription>
          Not joined yet. Each invite holds a seat until it is accepted, expires,
          or is revoked.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {invites.map((invite) => {
            const expired = new Date(invite.expiresAt) < new Date();

            return (
              <li
                key={invite.inviteId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{invite.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {WORKSPACE_ROLE_LABELS[invite.role]} ·{" "}
                    {expired
                      ? "expired"
                      : `expires ${new Date(invite.expiresAt).toLocaleDateString()}`}
                  </p>
                  {!expired && (
                    <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                      {invite.inviteUrl}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {!expired && (
                    <CopyLinkButton
                      url={invite.inviteUrl}
                      label={`invite link for ${invite.email}`}
                    />
                  )}
                  {canManage && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => revoke(invite.inviteId)}
                      disabled={revokingId === invite.inviteId}
                    >
                      {revokingId === invite.inviteId ? "Revoking…" : "Revoke"}
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
