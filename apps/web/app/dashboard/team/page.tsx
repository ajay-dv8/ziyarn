import type { Metadata } from "next";
import { headers } from "next/headers";

import { getPlanLimits, type Plan } from "@repo/api/plans";

import { TeamPage } from "@/components/team/team-page";
import { authService } from "@/services/auth-service";
import { domainsService } from "@/services/domains-service";
import { workspaceService } from "@/services/workspace-service";

export const metadata: Metadata = {
  title: "Team",
};

const PLAN_RANK: Record<Plan, number> = {
  free: 0,
  standard: 1,
  pro: 2,
  ultimate: 3,
  custom: 4,
};

export default async function TeamDashboardPage() {
  const requestHeaders = await headers();
  const session = await authService.getSession(requestHeaders);
  if (!session) return null;

  const domains = await domainsService.listDomains(requestHeaders);
  const plan = domains.reduce<Plan>(
    (best, domain) =>
      PLAN_RANK[domain.plan] > PLAN_RANK[best] ? domain.plan : best,
    "free",
  );
  const limits = getPlanLimits(plan);

  // Find the user's first workspace
  const workspaces = await workspaceService.listWorkspaces(requestHeaders);
  const workspace = workspaces[0];

  if (!workspace) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
          <p className="text-sm text-muted-foreground">
            You don&apos;t belong to any workspace yet.
          </p>
        </div>
      </div>
    );
  }

  const members = await workspaceService.listMembers(
    workspace.id,
    requestHeaders,
  );
  const invites = await workspaceService.listInvites(
    workspace.id,
    requestHeaders,
  );

  const isOwnerOrAdmin =
    workspace.role === "owner" || workspace.role === "admin";

  return (
    <TeamPage
      workspaceId={workspace.id}
      currentUserId={session.user.id}
      members={members}
      invites={invites}
      memberCount={members.length}
      maxMembers={limits.maxMembers}
      isOwnerOrAdmin={isOwnerOrAdmin}
    />
  );
}
