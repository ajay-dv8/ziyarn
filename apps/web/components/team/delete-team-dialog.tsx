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
import { toast } from "sonner";

import { deleteTeamAction, type TeamActionResult } from "@/lib/actions/workspaces";
import { APP_ROUTES } from "@/constants/routes";

/**
 * Confirms deleting a team. This is the most destructive thing on the page, so
 * the dialog names the team, states exactly what is lost and what is not, and
 * asks for the name back — a team can be months of membership work.
 */
export function DeleteTeamDialog({
  open,
  onOpenChange,
  workspaceId,
  teamName,
  memberCount,
  remainingTeams,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  teamName: string;
  memberCount: number;
  /** How many other teams the caller belongs to, for the landing copy. */
  remainingTeams: number;
}) {
  const router = useRouter();
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const matches = confirmation.trim() === teamName;

  const remove = async () => {
    setPending(true);
    setError(null);

    const result = (await deleteTeamAction({
      workspaceId,
    })) as TeamActionResult;

    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setConfirmation("");
    onOpenChange(false);
    toast.success(`${teamName} deleted`);
    // The deleted team may have been the selected one, so go back to a list
    // that is guaranteed to exist rather than to a team that no longer does.
    router.push(
      remainingTeams > 0 ? APP_ROUTES.DASHBOARD_TEAM : APP_ROUTES.DASHBOARD,
    );
    router.refresh();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) setConfirmation("");
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {teamName}?</DialogTitle>
          <DialogDescription>
            {memberCount > 0
              ? `${memberCount} ${memberCount === 1 ? "person" : "people"} will immediately lose access, and every pending invite is cancelled.`
              : "Every pending invite for this team is cancelled."}{" "}
            Domains and agents are owned by the people who created them, so they
            are not deleted.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <label htmlFor="delete-team-confirm" className="text-sm font-medium">
            Type <span className="font-mono">{teamName}</span> to confirm
          </label>
          <Input
            id="delete-team-confirm"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            autoComplete="off"
            disabled={pending}
            aria-invalid={Boolean(error)}
          />
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={remove}
            disabled={pending || !matches}
          >
            {pending ? "Deleting…" : `Delete ${teamName}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
