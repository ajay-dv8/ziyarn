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
  DialogTrigger,
} from "@repo/ui/components/dialog";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { PasswordInput } from "@repo/ui/components/password-input";

import { authClient } from "@/lib/auth-client";

export function DeleteAccountDialog() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function removeAccount() {
    setPending(true);
    setError(null);

    try {
      const { error: deleteError } = await authClient.deleteUser({
        password: password || undefined,
      });

      if (deleteError) {
        setPending(false);
        setError(
          deleteError.message ??
            "We could not delete your account. Please try again.",
        );
        return;
      }
    } catch {
      setPending(false);
      setError("Network error. Please try again.");
      return;
    }

    // The session cookie is cleared by the response; a full navigation drops
    // any cached server components that still belong to the deleted user.
    window.location.assign("/");
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setPassword("");
      setConfirmation("");
      setError(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button variant="destructive" size="sm">
            Delete my account
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete your account?</DialogTitle>
          <DialogDescription>
            This permanently removes your sign-in and personal settings. It
            cannot be undone. Transfer any workspaces you own and cancel your
            subscription first.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="delete-account-password">Password</Label>
            <PasswordInput
              id="delete-account-password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Required for email/password accounts. If you sign in with Google
              or LinkedIn, leave this blank and sign in again if prompted.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="delete-account-confirmation">
              Type DELETE to confirm
            </Label>
            <Input
              id="delete-account-confirmation"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="off"
            />
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={removeAccount}
            disabled={pending || confirmation !== "DELETE"}
          >
            {pending ? "Deleting…" : "Delete account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
