import type { Metadata } from "next";
import { headers } from "next/headers";

import { getPlanLimits, highestPlan } from "@repo/api/plans";
import { inviteUrl, type WorkspaceRole } from "@repo/api/workspaces";

import { TeamPage } from "@/components/team/team-page";
import { authService } from "@/services/auth-service";
import { domainsService } from "@/services/domains-service";
import { workspaceService } from "@/services/workspace-service";

export const metadata: Metadata = {
  title: "Team",
};

/** Workspace role strings come straight from the database. */
function asRole(role: string): WorkspaceRole {
  switch (role) {
    case "owner":
    case "admin":
    case "viewer":
      return role;
    default:
      return "member";
  }
}

export default async function TeamDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ workspace?: string }>;
}) {
  const requestHeaders = await headers();
  const session = await authService.getSession(requestHeaders);
  if (!session) return null;

  const [{ workspace: requestedWorkspaceId }, ownedDomains, memberships] =
    await Promise.all([
      searchParams,
      domainsService.listDomains(requestHeaders),
      workspaceService.listWorkspaces(requestHeaders),
    ]);

  // A user's plan comes from their domains; team limits follow it.
  const plan = highestPlan(ownedDomains.map((domain) => domain.plan));
  const limits = getPlanLimits(plan);

  const teams = memberships.map((membership) => ({
    id: membership.id,
    name: membership.name,
    role: asRole(membership.role),
  }));

  // Honour ?workspace= only for a team the user actually belongs to, so a
  // stale or guessed link lands on their own team instead of erroring.
  const selectedTeam =
    teams.find((team) => team.id === requestedWorkspaceId) ?? teams[0] ?? null;

  const canCreateTeam = memberships.length < limits.maxWorkspaces;

  if (!selectedTeam) {
    return (
      <TeamPage
        teams={teams}
        selectedTeam={null}
        currentUserId={session.user.id}
        members={[]}
        invites={[]}
        seatsUsed={0}
        maxMembers={limits.maxMembers}
        canManage={false}
        canCreateTeam={canCreateTeam}
        maxTeams={limits.maxWorkspaces}
      />
    );
  }

  const [members, invites] = await Promise.all([
    workspaceService.listMembers(selectedTeam.id, requestHeaders),
    workspaceService.listInvites(selectedTeam.id, requestHeaders),
  ]);

  // Members and pending invites both hold a seat, so the header count has to
  // include invites or it will disagree with the invite form's own limit.
  const seatsUsed = members.length + invites.length;

  return (
    <TeamPage
      teams={teams}
      selectedTeam={selectedTeam}
      currentUserId={session.user.id}
      members={members.map((entry) => ({
        memberId: entry.member.id,
        userId: entry.member.userId,
        role: asRole(entry.member.role),
        name: entry.userName,
        email: entry.userEmail,
        image: entry.userImage,
      }))}
      invites={invites.map((invite) => ({
        inviteId: invite.id,
        email: invite.email,
        role: asRole(invite.role),
        inviteUrl: inviteUrl(invite.token),
        expiresAt: invite.expiresAt.toISOString(),
      }))}
      seatsUsed={seatsUsed}
      maxMembers={limits.maxMembers}
      canManage={selectedTeam.role === "owner" || selectedTeam.role === "admin"}
      canCreateTeam={canCreateTeam}
      maxTeams={limits.maxWorkspaces}
    />
  );
}
