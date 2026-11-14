"use client";

import { useEffect, useState } from "react";
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

import {
  createWorkspaceAction,
  renameWorkspaceAction,
  type WorkspaceActionResult,
} from "@/lib/actions/workspaces";
import { APP_ROUTES } from "@/constants/routes";

/**
 * One dialog for the two things a team is named: creating it and renaming it.
 * They differ only in what they call and where they send you afterwards, and
 * keeping them together means the validation, the disabled state and the error
 * copy cannot drift apart.
 */
export function TeamNameDialog({
  open,
  onOpenChange,
  mode,
  workspaceId,
  currentName,
  canCreate,
  maxTeams,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "rename";
  /** Required when renaming. */
  workspaceId?: string;
  currentName?: string;
  canCreate: boolean;
  maxTeams: number;
}) {
  const router = useRouter();
  const [name, setName] = useState(currentName ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCreate = mode === "create";

  // Re-seed the field each time the dialog opens, so a rename never starts from
  // the previous team's name and a create never starts from a stale draft.
  useEffect(() => {
    if (!open) return;
    setName(isCreate ? "" : (currentName ?? ""));
    setError(null);
  }, [open, isCreate, currentName]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    setPending(true);
    setError(null);

    const result = (
      isCreate
        ? await createWorkspaceAction({ name: trimmed })
        : await renameWorkspaceAction({ workspaceId: workspaceId ?? "", name: trimmed })
    ) as WorkspaceActionResult;

    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    onOpenChange(false);
    if (isCreate) {
      toast.success("Workspace created");
      // Land on the workspace just created, not on whatever was selected before.
      router.push(
        result.workspaceId
          ? `${APP_ROUTES.DASHBOARD_WORKSPACES}?workspace=${result.workspaceId}`
          : APP_ROUTES.DASHBOARD_WORKSPACES,
      );
    } else {
      toast.success("Workspace renamed");
    }
    router.refresh();
  };

  const blockedByPlan = isCreate && !canCreate;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isCreate ? "Create a workspace" : "Rename workspace"}</DialogTitle>
          <DialogDescription>
            {isCreate
              ? "A workspace is your organization. Teams live inside it. You become its owner."
              : "Pick a name your organization will recognise. Domains and teams are not affected."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} noValidate className="space-y-2">
          <Label htmlFor="workspace-dialog-name">Workspace name</Label>
          <Input
            id="workspace-dialog-name"
            name="name"
            placeholder="Acme Corp"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={100}
            autoFocus
            disabled={pending || blockedByPlan}
            aria-invalid={Boolean(error)}
          />

          {blockedByPlan && (
            <p className="text-sm text-muted-foreground">
              Your plan allows {maxTeams} workspace{maxTeams === 1 ? "" : "s"}. Upgrade
              to create another.
            </p>
          )}

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
            <Button type="submit" disabled={pending || blockedByPlan || !name.trim()}>
              {pending
                ? isCreate
                  ? "Creating…"
                  : "Saving…"
                : isCreate
                  ? "Create workspace"
                  : "Save name"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
