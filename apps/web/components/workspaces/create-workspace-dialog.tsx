"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { toast } from "sonner";

import { createWorkspaceAction } from "@/lib/actions/workspaces";

/** Controlled workspace-create dialog, so any trigger can open it. */
export function CreateWorkspaceDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Runs after the workspace exists, e.g. to switch to it. */
  onCreated?: (workspaceId: string) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    setPending(true);
    setError(null);

    const result = await createWorkspaceAction({ name: trimmed });

    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    onOpenChange(false);
    toast.success("Workspace created");
    setName("");
    if (result.workspaceId) onCreated?.(result.workspaceId);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a workspace</DialogTitle>
          <DialogDescription>
            A workspace is your organization. Teams live inside it.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} noValidate className="space-y-2">
          <Label htmlFor="create-workspace-dialog-name">Workspace name</Label>
          <Input
            id="create-workspace-dialog-name"
            name="name"
            placeholder="Acme Corp"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={100}
            autoFocus
            disabled={pending}
            aria-invalid={Boolean(error)}
          />

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !name.trim()}>
              {pending ? "Creating…" : "Create workspace"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
