"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@repo/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { Building2, Check, ChevronsUpDown, Plus } from "lucide-react";

import { CreateWorkspaceDialog } from "@/components/workspaces/create-workspace-dialog";
import { refreshNotificationSummary } from "@/hooks/use-notification-summary";
import { setActiveWorkspaceCookie } from "@/lib/active-workspace";

export type WorkspaceSummary = {
  id: string;
  name: string;
};

/**
 * Header workspace picker: shows the active workspace's name with an
 * up/down chevron; the menu lists workspaces and a create action. Ghost
 * styling throughout — it is a picker, not a call to action.
 */
export function WorkspaceSwitcher({
  workspaces,
  activeWorkspaceId,
}: {
  workspaces: WorkspaceSummary[];
  activeWorkspaceId: string | null;
}) {
  const router = useRouter();
  const activeWorkspace = workspaces.find(
    (workspace) => workspace.id === activeWorkspaceId,
  );
  const [dialogOpen, setDialogOpen] = useState(false);

  const activate = (workspaceId: string) => {
    setActiveWorkspaceCookie(workspaceId);
    refreshNotificationSummary();
    router.refresh();
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              className="max-w-56 gap-2 font-normal text-muted-foreground"
              aria-label="Switch workspace"
            />
          }
        >
          <Building2 className="h-4 w-4 shrink-0" />
          <span className="truncate">
            {activeWorkspace?.name ?? "No workspace"}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0" />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-56">
          {workspaces.map((workspace) => (
            <DropdownMenuItem
              key={workspace.id}
              className="gap-2"
              onClick={() => activate(workspace.id)}
            >
              <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{workspace.name}</span>
              {workspace.id === activeWorkspaceId && (
                <Check className="h-4 w-4 shrink-0" />
              )}
            </DropdownMenuItem>
          ))}

          {workspaces.length === 0 && (
            <div className="px-1.5 py-1 text-sm text-muted-foreground">
              No workspaces yet
            </div>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuItem className="gap-2" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />
            Create workspace
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateWorkspaceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={(workspaceId) => {
          setActiveWorkspaceCookie(workspaceId);
          refreshNotificationSummary();
        }}
      />
    </>
  );
}
