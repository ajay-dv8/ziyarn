"use client";

import { useState } from "react";

import { Button } from "@repo/ui/components/button";
import { Plus } from "lucide-react";

import { CreateWorkspaceDialog } from "@/components/workspaces/create-workspace-dialog";

export function CreateWorkspaceButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4 mr-2" />
        New workspace
      </Button>

      <CreateWorkspaceDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
