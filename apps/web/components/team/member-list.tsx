"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { type WorkspaceRole } from "@repo/api/workspaces/roles";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/ui/components/avatar";
import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui/components/dialog";
import { toast } from "sonner";

import { RoleSelect } from "@/components/team/role-select";
import { removeMemberAction } from "@/lib/actions/workspaces";

export type TeamMember = {
  memberId: string;
  userId: string;
  role: WorkspaceRole;
  name: string | null;
  email: string;
  image: string | null;
};

export function MemberList({
  workspaceId,
  teamName,
  members,
  currentUserId,
  canManage,
  viewerIsOwner,
}: {
  workspaceId: string;
  teamName: string;
  members: TeamMember[];
  currentUserId: string;
  canManage: boolean;
  /** Only the owner may remove an admin — the service enforces this too. */
  viewerIsOwner: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Members</CardTitle>
        <CardDescription>People with access to {teamName}.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {members.map((member) => (
            <li key={member.memberId}>
              <MemberRow
                workspaceId={workspaceId}
                teamName={teamName}
                member={member}
                isCurrentUser={member.userId === currentUserId}
                canManage={canManage}
                viewerIsOwner={viewerIsOwner}
              />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function MemberRow({
  workspaceId,
  teamName,
  member,
  isCurrentUser,
  canManage,
  viewerIsOwner,
}: {
  workspaceId: string;
  teamName: string;
  member: TeamMember;
  isCurrentUser: boolean;
  canManage: boolean;
  viewerIsOwner: boolean;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const isSelf = isCurrentUser;
  const canRemove =
    canManage && member.role !== "owner" && !isSelf && viewerIsOwner;

  const displayName = member.name ?? member.email;
  const initials = displayName.trim().charAt(0).toUpperCase() || "?";

  const remove = async () => {
    setPending(true);
    const result = await removeMemberAction({
      workspaceId,
      memberId: member.memberId,
    });
    setPending(false);
    setConfirmOpen(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(`${displayName} removed from ${teamName}`);
    router.refresh();
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar>
          {member.image && <AvatarImage src={member.image} alt="" />}
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {displayName}
            {isSelf && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                (you)
              </span>
            )}
          </p>
          <p className="truncate text-xs text-muted-foreground">{member.email}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <RoleSelect
          workspaceId={workspaceId}
          memberId={member.memberId}
          role={member.role}
          disabled={!canManage}
        />

        {canRemove && (
          <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <DialogTrigger
              render={
                <Button variant="ghost" size="sm">
                  Remove
                </Button>
              }
            />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Remove {displayName}?</DialogTitle>
                <DialogDescription>
                  They lose access to {teamName} immediately. Their own account
                  and any domains they own are untouched, and you can invite
                  them again later.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConfirmOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={remove}
                  disabled={pending}
                >
                  {pending ? "Removing…" : "Remove member"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}
