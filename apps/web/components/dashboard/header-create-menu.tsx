"use client";

import { useState } from "react";

import { Button } from "@repo/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { Building2, Globe, Plus, Users } from "lucide-react";

import { CreateDomainSheet } from "@/components/domains/create-domain-sheet";
import { CreateTeamDialog } from "@/components/workspaces/create-team-dialog";
import { CreateWorkspaceDialog } from "@/components/workspaces/create-workspace-dialog";

import {
  useActiveWorkspaceId,
  type WorkspaceSummary,
} from "@/components/dashboard/workspace-switcher";

type CreateTarget = "workspace" | "domain" | "team" | null;

/**
 * The header "Create" action: one ghost button, one menu, one dialog per
 * target. Team creation needs an active workspace, so it is disabled when the
 * user has none.
 */
export function HeaderCreateMenu({
  workspaces,
}: {
  workspaces: WorkspaceSummary[];
}) {
  const activeWorkspaceId = useActiveWorkspaceId(workspaces);
  const [dialog, setDialog] = useState<CreateTarget>(null);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5"
              aria-label="Create new"
            />
          }
        >
          <Plus className="h-4 w-4" />
          <span>Create</span>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem className="gap-2" onClick={() => setDialog("workspace")}>
            <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
            Workspace
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2" onClick={() => setDialog("domain")}>
            <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
            Domain
          </DropdownMenuItem>
          <DropdownMenuItem
            className="gap-2"
            disabled={!activeWorkspaceId}
            title={activeWorkspaceId ? undefined : "Create a workspace first"}
            onClick={() => setDialog("team")}
          >
            <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
            Team
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateWorkspaceDialog
        open={dialog === "workspace"}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setDialog(null);
        }}
      />
      <CreateDomainSheet
        open={dialog === "domain"}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setDialog(null);
        }}
      />
      <CreateTeamDialog
        open={dialog === "team"}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setDialog(null);
        }}
        workspaceId={activeWorkspaceId}
      />
    </>
  );
}
