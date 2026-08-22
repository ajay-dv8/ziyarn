"use client";

import { useState } from "react";

import { Button } from "@repo/ui/components/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@repo/ui/components/sheet";
import { Plus } from "lucide-react";

import { CreateDomainForm } from "@/components/domains/create-domain-form";

export function CreateDomainButton({
  variant = "default",
}: {
  variant?: "default" | "sub";
}) {
  const [open, setOpen] = useState(false);

  if (variant === "sub") {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          render={
            <button
              className="flex h-7 min-w-0 -translate-x-px items-center gap-2 overflow-hidden rounded-md px-2 text-sm text-sidebar-foreground ring-sidebar-ring outline-hidden hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 group-data-[collapsible=icon]:hidden"
              type="button"
            >
              <Plus className="h-4 w-4 shrink-0" />
              <span>New domain</span>
            </button>
          }
        />
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>New domain</SheetTitle>
            <SheetDescription>
              Pick a name and a unique slug — the slug becomes part of your
              widget URL.
            </SheetDescription>
          </SheetHeader>
          <div className="px-6 py-4">
            <CreateDomainForm />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New domain
          </Button>
        }
      />
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>New domain</SheetTitle>
          <SheetDescription>
            Pick a name and a unique slug — the slug becomes part of your
            widget URL.
          </SheetDescription>
        </SheetHeader>
        <div className="px-6 py-4">
          <CreateDomainForm />
        </div>
      </SheetContent>
    </Sheet>
  );
}
