"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@repo/ui/components/sheet";

import { CreateDomainForm } from "@/components/domains/create-domain-form";

/** Controlled domain-create sheet, so any trigger can open it. */
export function CreateDomainSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>New domain</SheetTitle>
          <SheetDescription>
            Pick a name and a unique slug — the slug becomes part of your
            widget URL.
          </SheetDescription>
        </SheetHeader>
        <div className="px-6 py-4">
          <CreateDomainForm onCreated={() => onOpenChange(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
