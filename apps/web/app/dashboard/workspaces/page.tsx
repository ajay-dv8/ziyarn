import type { Metadata } from "next";
import { headers } from "next/headers";

import {
  Card, 
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";

import { CreateWorkspaceButton } from "@/components/workspaces/create-workspace-button";
import { APP_ROUTES } from "@/constants/routes";
import { workspaceService } from "@/services/workspace-service";

export const metadata: Metadata = {
  title: "Workspaces",
};

export default async function WorkspacesPage() {
  const requestHeaders = await headers();
  const workspaces = await workspaceService.listWorkspaces(requestHeaders);

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold">Workspaces</h1>
          <p className="text-sm text-muted-foreground">
            A workspace is your organization. Create teams inside it.
          </p>
        </div>

        <CreateWorkspaceButton />
      </div>

      <div className="space-y-4">
        {workspaces.map((workspace) => (
          <Card key={workspace.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
              <div className="flex min-w-0 items-start gap-3">
                <CardTitle className="truncate">
                  <a
                    href={`${APP_ROUTES.DASHBOARD_WORKSPACE_TEAMS.replace(
                      "[workspaceId]",
                      workspace.id,
                    )}`}
                    className="hover:underline underline-offset-4"
                  >
                    {workspace.name}
                  </a>
                </CardTitle>
                <CardDescription>
                  {workspace.role} ·
                  {new Date(workspace.createdAt).toLocaleDateString()}
                </CardDescription>
              </div>
            </CardHeader>
          </Card>
        ))}
        {workspaces.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No workspaces yet — click &quot;New workspace&quot; to get started.
          </p>
        )}
      </div>
    </div>
  );
}
