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

import { API_ROUTES } from "@/constants/routes";

/** Controlled team-create dialog; a team always belongs to a workspace. */
export function CreateTeamDialog({
  open,
  onOpenChange,
  workspaceId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The workspace the team is created in. */
  workspaceId: string | null;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || !workspaceId) return;

    setPending(true);
    setError(null);

    try {
      const response = await fetch(API_ROUTES.teams.root, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, workspaceId }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        setError(result?.message || "Failed to create team");
        setPending(false);
        return;
      }

      onOpenChange(false);
      toast.success("Team created");
      setName("");
      router.refresh();
    } catch {
      setError("Failed to create team");
      setPending(false);
    }
  };

  if (!workspaceId) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a team</DialogTitle>
          <DialogDescription>
            A team groups people inside this workspace.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} noValidate className="space-y-2">
          <Label htmlFor="create-team-dialog-name">Team name</Label>
          <Input
            id="create-team-dialog-name"
            name="name"
            placeholder="Support Team"
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
              {pending ? "Creating…" : "Create team"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
