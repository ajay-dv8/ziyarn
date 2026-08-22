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

export function CreateDomainButton() {
  const [open, setOpen] = useState(false);

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
