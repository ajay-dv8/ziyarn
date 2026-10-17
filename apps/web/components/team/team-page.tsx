"use client";

import { useState } from "react";

import type { WorkspaceRole } from "@repo/api/workspaces/roles";
import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";

import { DeleteTeamDialog } from "@/components/team/delete-team-dialog";
import { InviteMemberForm } from "@/components/team/invite-member-form";
import { MemberList, type TeamMember } from "@/components/team/member-list";
import { PendingInviteList, type TeamInvite } from "@/components/team/invite-list";
import { TeamNameDialog } from "@/components/team/team-name-dialog";
import { APP_ROUTES } from "@/constants/routes";

export type TeamSummary = {
  id: string;
  name: string;
  role: WorkspaceRole;
};

/**
 * The team screen: create a team, invite people into it, and manage the team
 * and the people in it. Every list is rendered from server props, so each
 * mutation goes through a server action and comes back as a fresh render — no
 * client-side bookkeeping that can drift from the database.
 */
export function TeamPage({
  teams,
  selectedTeam,
  currentUserId,
  members,
  invites,
  seatsUsed,
  maxMembers,
  canManage,
  canCreateTeam,
  maxTeams,
}: {
  teams: TeamSummary[];
  selectedTeam: TeamSummary | null;
  currentUserId: string;
  members: TeamMember[];
  invites: TeamInvite[];
  seatsUsed: number;
  maxMembers: number;
  /** Owners and admins may invite people, change roles and edit the team. */
  canManage: boolean;
  canCreateTeam: boolean;
  maxTeams: number;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
          <p className="text-sm text-muted-foreground">
            {selectedTeam
              ? `Manage who can work in ${selectedTeam.name} · ${seatsUsed} of ${maxMembers} seats used`
              : "Create a team, then invite the people who work with you."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {selectedTeam && canManage && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="outline" size="icon" aria-label="Team options" />
                }
              >
                <MoreHorizontal />
              </DropdownMenuTrigger>
              {/* Anchored to the icon trigger's width by default, which wraps
                  "Rename team" onto two lines. */}
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={() => setRenameOpen(true)}>
                  <Pencil data-icon="inline-start" />
                  Rename team
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 data-icon="inline-start" />
                  Delete team
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <Button onClick={() => setCreateOpen(true)} disabled={!canCreateTeam}>
            <Plus data-icon="inline-start" />
            Create team
          </Button>
        </div>
      </div>

      {teams.length > 1 && (
        <nav aria-label="Your teams" className="flex flex-wrap gap-2">
          {teams.map((team) => {
            const isSelected = team.id === selectedTeam?.id;
            return (
              <a
                key={team.id}
                href={`${APP_ROUTES.DASHBOARD_TEAM}?workspace=${team.id}`}
                aria-current={isSelected ? "page" : undefined}
                className={
                  isSelected
                    ? "rounded-full bg-primary px-3 py-1 text-sm font-medium text-primary-foreground"
                    : "rounded-full border px-3 py-1 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                }
              >
                {team.name}
              </a>
            );
          })}
        </nav>
      )}

      {selectedTeam ? (
        <>
          {canManage && (
            <InviteMemberForm
              workspaceId={selectedTeam.id}
              seatsUsed={seatsUsed}
              maxMembers={maxMembers}
            />
          )}

          <MemberList
            workspaceId={selectedTeam.id}
            teamName={selectedTeam.name}
            members={members}
            currentUserId={currentUserId}
            canManage={canManage}
            viewerIsOwner={selectedTeam.role === "owner"}
          />

          {invites.length > 0 && (
            <PendingInviteList
              workspaceId={selectedTeam.id}
              invites={invites}
              canManage={canManage}
            />
          )}
        </>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No team yet</CardTitle>
            <CardDescription>
              Create a team to group the agents, domains and knowledge bases
              your people work on. You become its owner and can invite them
              straight after.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setCreateOpen(true)} disabled={!canCreateTeam}>
              <Plus data-icon="inline-start" />
              Create team
            </Button>
          </CardContent>
        </Card>
      )}

      <TeamNameDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        canCreate={canCreateTeam}
        maxTeams={maxTeams}
      />

      {selectedTeam && (
        <>
          <TeamNameDialog
            open={renameOpen}
            onOpenChange={setRenameOpen}
            mode="rename"
            workspaceId={selectedTeam.id}
            currentName={selectedTeam.name}
            canCreate={canCreateTeam}
            maxTeams={maxTeams}
          />

          {canManage && (
            <DeleteTeamDialog
              open={deleteOpen}
              onOpenChange={setDeleteOpen}
              workspaceId={selectedTeam.id}
              teamName={selectedTeam.name}
              memberCount={members.length}
              remainingTeams={teams.length - 1}
            />
          )}
        </>
      )}
    </div>
  );
}
