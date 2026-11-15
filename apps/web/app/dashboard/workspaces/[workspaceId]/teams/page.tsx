import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";

import { CreateTeamButton } from "@/components/workspaces/create-team-button";
import { APP_ROUTES } from "@/constants/routes";
import { teamService } from "@/services/team-service";
import { workspaceService } from "@/services/workspace-service";

export const metadata: Metadata = {
  title: "Teams",
};

export default async function WorkspaceTeamsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const requestHeaders = await headers();

  const [workspace, teams] = await Promise.all([
    workspaceService.getWorkspace(workspaceId, requestHeaders),
    teamService.listTeams(workspaceId, requestHeaders),
  ]);

  const canManage = workspace.role === "owner" || workspace.role === "admin";

  return (
    <div className="space-y-8">
      <div>
        <Link
          href={APP_ROUTES.DASHBOARD_WORKSPACES}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← All workspaces
        </Link>
        <div className="mt-3 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{workspace.name} teams</h1>
            <p className="text-sm text-muted-foreground">
              Teams group people, agents and knowledge bases inside this
              workspace.
            </p>
          </div>

          {canManage && <CreateTeamButton workspaceId={workspaceId} />}
        </div>
      </div>

      <div className="space-y-4">
        {teams.map((team) => (
          <Card key={team.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
              <div className="flex min-w-0 items-start gap-3">
                <CardTitle className="truncate">{team.name}</CardTitle>
                <CardDescription>
                  {team.role ?? "not a member"} ·{" "}
                  {new Date(team.createdAt).toLocaleDateString()}
                </CardDescription>
              </div>
            </CardHeader>
          </Card>
        ))}
        {teams.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {canManage
              ? 'No teams yet — click "New team" to get started.'
              : "You are not in any teams in this workspace yet."}
          </p>
        )}
      </div>
    </div>
  );
}
