"use client";

import type { WorkspaceRole } from "@repo/api/workspaces/roles";

import { CreateTeamForm } from "@/components/team/create-team-form";
import { InviteMemberForm } from "@/components/team/invite-member-form";
import { MemberList, type TeamMember } from "@/components/team/member-list";
import { PendingInviteList, type TeamInvite } from "@/components/team/invite-list";
import { APP_ROUTES } from "@/constants/routes";

export type TeamSummary = {
  id: string;
  name: string;
  role: WorkspaceRole;
};

/**
 * The team screen: create a team, invite people into it, and manage who is in
 * it. Every list is rendered from server props, so each mutation goes through a
 * server action and comes back as a fresh render — no client-side bookkeeping
 * that can drift from the database.
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
  /** Owners and admins may invite people and change roles. */
  canManage: boolean;
  canCreateTeam: boolean;
  maxTeams: number;
}) {
  const showCreateForm = !selectedTeam || canCreateTeam;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
        <p className="text-sm text-muted-foreground">
          {selectedTeam
            ? `Manage who can work in ${selectedTeam.name} · ${seatsUsed} of ${maxMembers} seats used`
            : "Create a team, then invite the people who work with you."}
        </p>
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
      ) : null}

      {showCreateForm && (
        <CreateTeamForm canCreate={canCreateTeam} maxTeams={maxTeams} />
      )}
    </div>
  );
}
