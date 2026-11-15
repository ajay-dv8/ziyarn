"use client";

import { useState } from "react";

import { Button } from "@repo/ui/components/button";
import { Plus } from "lucide-react";

import { CreateDomainSheet } from "@/components/domains/create-domain-sheet";

export function CreateDomainButton({
  variant = "default",
}: {
  variant?: "default" | "sub";
}) {
  const [open, setOpen] = useState(false);

  if (variant === "sub") {
    return (
      <>
        <button
          className="flex h-7 min-w-0 -translate-x-px items-center gap-2 overflow-hidden rounded-md px-2 text-sm text-sidebar-foreground ring-sidebar-ring outline-hidden hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 group-data-[collapsible=icon]:hidden"
          type="button"
          onClick={() => setOpen(true)}
        >
          <Plus className="h-4 w-4 shrink-0" />
          <span>New domain</span>
        </button>
        <CreateDomainSheet open={open} onOpenChange={setOpen} />
      </>
    );
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4 mr-2" />
        New domain
      </Button>
      <CreateDomainSheet open={open} onOpenChange={setOpen} />
    </>
  );
}
