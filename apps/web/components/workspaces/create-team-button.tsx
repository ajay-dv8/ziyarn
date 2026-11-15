"use client";

import { useState } from "react";

import { Button } from "@repo/ui/components/button";
import { Plus } from "lucide-react";

import { CreateTeamDialog } from "@/components/workspaces/create-team-dialog";

export function CreateTeamButton({
  workspaceId,
}: {
  workspaceId: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4 mr-2" />
        New team
      </Button>

      <CreateTeamDialog open={open} onOpenChange={setOpen} workspaceId={workspaceId} />
    </>
  );
}
