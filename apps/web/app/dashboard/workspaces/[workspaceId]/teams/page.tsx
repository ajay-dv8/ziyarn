import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";

import { CreateTeamButton } from "@/components/workspaces/create-team-button";
import { APP_ROUTES } from "@/constants/routes";
import { teamService } from "@/services/team-service";

export const metadata: Metadata = {
  title: "Teams",
};

export default async function WorkspaceTeamsPage({
  searchParams,
}: {
  searchParams: Promise<{ workspaceId?: string }>;
}) {
  const requestHeaders = await headers();
  const { workspaceId } = await searchParams;

  if (!workspaceId) {
    redirect(APP_ROUTES.DASHBOARD_WORKSPACES);
  }

  const teams = await teamService.listTeams(workspaceId, requestHeaders);

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold">Teams</h1>
          <p className="text-sm text-muted-foreground">
            Teams group people, agents and knowledge bases inside this workspace.
          </p>
        </div>

        <CreateTeamButton workspaceId={workspaceId} />
      </div>

      <div className="space-y-4">
        {teams.map((team) => (
          <Card key={team.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
              <div className="flex min-w-0 items-start gap-3">
                <CardTitle className="truncate">
                  <a
                    href="#"
                    className="hover:underline underline-offset-4"
                  >
                    {team.name}
                  </a>
                </CardTitle>
                <CardDescription>
                  {team.role} ·
                  {new Date(team.createdAt).toLocaleDateString()}
                </CardDescription>
              </div>
            </CardHeader>
          </Card>
        ))}
        {teams.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No teams yet — click &quot;New team&quot; to get started.
          </p>
        )}
      </div>
    </div>
  );
}
