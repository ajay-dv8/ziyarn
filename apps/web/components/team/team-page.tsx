"use client";

import { useState } from "react";

import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { Input } from "@repo/ui/components/input";
import { toast } from "sonner";

type Member = {
  member: {
    id: string;
    workspaceId: string;
    userId: string;
    role: string;
    createdAt: Date;
  };
  userName: string;
  userEmail: string;
  userImage: string | null;
};

type Invite = {
  id: string;
  workspaceId: string;
  email: string;
  role: string;
  token: string;
  invitedBy: string;
  expiresAt: Date;
  createdAt: Date;
};

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
  viewer: "Viewer",
};

export function TeamPage({
  workspaceId,
  currentUserId,
  members,
  invites,
  memberCount,
  maxMembers,
  isOwnerOrAdmin,
}: {
  workspaceId: string;
  currentUserId: string;
  members: Member[];
  invites: Invite[];
  memberCount: number;
  maxMembers: number;
  isOwnerOrAdmin: boolean;
}) {
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [sending, setSending] = useState(false);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setSending(true);
    try {
      const response = await fetch(
        `/api/workspace/${workspaceId}/invite`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
        },
      );

      if (!response.ok) {
        const error = await response.json();
        toast.error(error.message || "Failed to send invite");
        return;
      }

      toast.success("Invite sent");
      setInviteEmail("");
      setInviteRole("member");
    } catch {
      toast.error("Failed to send invite");
    } finally {
      setSending(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      const response = await fetch(
        `/api/workspace/${workspaceId}/members/${memberId}`,
        { method: "DELETE" },
      );

      if (!response.ok) {
        const error = await response.json();
        toast.error(error.message || "Failed to remove member");
        return;
      }

      toast.success("Member removed");
    } catch {
      toast.error("Failed to remove member");
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    try {
      const response = await fetch(
        `/api/workspace/${workspaceId}/invites/${inviteId}`,
        { method: "DELETE" },
      );

      if (!response.ok) {
        const error = await response.json();
        toast.error(error.message || "Failed to revoke invite");
        return;
      }

      toast.success("Invite revoked");
    } catch {
      toast.error("Failed to revoke invite");
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
        <p className="text-sm text-muted-foreground">
          Manage your workspace members and invites. {memberCount} of{" "}
          {maxMembers} seats used.
        </p>
      </div>

      {isOwnerOrAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Invite member</CardTitle>
            <CardDescription>
              Send an email invite to join this workspace.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                placeholder="Email address"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                className="flex-1"
              />
              <select
                value={inviteRole}
                onChange={(event) => setInviteRole(event.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="admin">Admin</option>
                <option value="member">Member</option>
                <option value="viewer">Viewer</option>
              </select>
              <Button onClick={handleInvite} disabled={sending || !inviteEmail.trim()}>
                {sending ? "Sending..." : "Invite"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>People with access to this workspace.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {members.map((member) => {
              const isCurrentUser = member.member.userId === currentUserId;
              const isTargetOwner = member.member.role === "owner";

              return (
                <div
                  key={member.member.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-medium">
                      {member.userName?.charAt(0).toUpperCase() ?? "?"}
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {member.userName}
                        {isCurrentUser && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            (you)
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {member.userEmail}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {ROLE_LABELS[member.member.role] ?? member.member.role}
                    </span>
                    {isOwnerOrAdmin && !isTargetOwner && !isCurrentUser && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveMember(member.member.id)}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {invites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending invites</CardTitle>
            <CardDescription>Invites waiting to be accepted.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {invites.map((invite) => (
                <div
                  key={invite.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div>
                    <p className="text-sm font-medium">{invite.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {ROLE_LABELS[invite.role] ?? invite.role} — expires{" "}
                      {new Date(invite.expiresAt).toLocaleDateString()}
                    </p>
                  </div>
                  {isOwnerOrAdmin && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRevokeInvite(invite.id)}
                    >
                      Revoke
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
