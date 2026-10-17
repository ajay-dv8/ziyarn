"use client";

import { useState } from "react";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

import type { BusinessType } from "@repo/api/domains/business-types";
import type { WidgetVariantId } from "@repo/api/domains/widget-variants";
import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";

import { deleteDomainAction, type ActionResult } from "@/lib/actions/domains";

import { BusinessTypeEditor } from "@/components/domains/business-type-editor";
import { RenameDomainForm } from "@/components/domains/rename-domain-form";
import { WidgetVariantPicker } from "@/components/domains/widget-variant-picker";

/**
 * Per-domain actions, collapsed into one overflow menu on the card header.
 *
 * Edit opens a dialog holding every non-destructive setting for the domain
 * (rename + business type, which together drive the dashboard labels, system
 * prompt and page visibility). Delete is deliberately a separate dialog rather
 * than a menu item that fires immediately — it is irreversible and cascades to
 * agents, conversations, messages, products, bookings, customers and payments.
 */
export function DomainCardMenu({
  domainId,
  domainName,
  businessType,
  widgetVariant,
}: {
  domainId: string;
  domainName: string;
  businessType: BusinessType | null;
  widgetVariant: WidgetVariantId;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDelete() {
    setPending(true);
    setError(null);
    const result = (await deleteDomainAction(domainId)) as ActionResult;

    if (!result.ok) {
      setPending(false);
      setError(result.error);
      return;
    }

    // The card this dialog belongs to is gone after the refresh.
    setDeleteOpen(false);
    setPending(false);
    router.refresh();
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="-mt-1 shrink-0 text-foreground border-border hover:bg-accent hover:text-foreground/80"
              aria-label={`Actions for ${domainName}`}
            />
          }
        >
          <MoreVertical className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem
            onClick={() => {
              setEditOpen(true);
            }}
          >
            <Pencil className="size-4" />
            Edit domain
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => {
              setError(null);
              setDeleteOpen(true);
            }}
          >
            <Trash2 className="size-4" />
            Delete domain
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* ---- Edit ---- */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit {domainName}</DialogTitle>
            <DialogDescription>
              Update how this domain is labelled and how its agent behaves.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="space-y-2">
              <label
                htmlFor={`domain-name-${domainId}`}
                className="text-sm font-medium"
              >
                Name
              </label>
              <RenameDomainForm
                domainId={domainId}
                currentName={domainName}
                id={`domain-name-${domainId}`}
                onSaved={() => setEditOpen(false)}
              />
            </div>

            <div className="border-t pt-5">
              <BusinessTypeEditor
                domainId={domainId}
                currentType={businessType}
              />
            </div>

            <div className="border-t pt-5">
              <WidgetVariantPicker
                domainId={domainId}
                currentVariant={widgetVariant}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ---- Delete (irreversible) ---- */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete {domainName}?</DialogTitle>
            <DialogDescription>
              This permanently deletes the domain along with its agents,
              conversations, messages, products, bookings, customers and
              payments. This cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              {pending ? "Deleting…" : "Cancel"}
            </DialogClose>
            <Button
              variant="destructive"
              onClick={onDelete}
              disabled={pending}
            >
              {pending ? "Deleting…" : "Delete domain"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}