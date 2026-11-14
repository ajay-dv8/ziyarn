"use client";

import { useState } from "react";

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
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { API_ROUTES } from "@/constants/routes";

export function CreateTeamButton({
  workspaceId,
}: {
  workspaceId: string;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    setPending(true);
    setError(null);

    try {
      const response = await fetch(API_ROUTES.teams.root, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, workspaceId }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result?.message || "Failed to create team");
        setPending(false);
        return;
      }

      setOpen(false);
      toast.success("Team created");
      setName("");
      window.location.reload();
    } catch {
      setError("Failed to create team");
      setPending(false);
    }
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4 mr-2" />
        New team
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a team</DialogTitle>
            <DialogDescription>
              A team groups people, agents and knowledge bases inside this
              workspace.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={submit} noValidate className="space-y-2">
            <Label htmlFor="team-dialog-name">Team name</Label>
            <Input
              id="team-dialog-name"
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
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={pending || !name.trim()}
              >
                {pending ? "Creating…" : "Create team"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
