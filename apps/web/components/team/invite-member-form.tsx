"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  ASSIGNABLE_WORKSPACE_ROLES,
  WORKSPACE_ROLE_DESCRIPTIONS,
  WORKSPACE_ROLE_LABELS,
  type AssignableWorkspaceRole,
} from "@repo/api/workspaces/roles";
import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { toast } from "sonner";

import { CopyLinkButton } from "@/components/team/copy-link-button";
import {
  inviteMemberAction,
  type TeamActionResult,
} from "@/lib/actions/workspaces";

export function InviteMemberForm({
  workspaceId,
  seatsUsed,
  maxMembers,
}: {
  workspaceId: string;
  seatsUsed: number;
  maxMembers: number;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AssignableWorkspaceRole>("member");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentLink, setSentLink] = useState<string | null>(null);

  // Pending invites hold their seat, so the count the owner sees must include
  // them or the form will offer a seat the plan will refuse.
  const seatsLeft = Math.max(maxMembers - seatsUsed, 0);

  const invite = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim()) return;

    setPending(true);
    setError(null);

    const result = (await inviteMemberAction({
      workspaceId,
      email,
      role,
    })) as TeamActionResult;

    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setEmail("");
    setRole("member");
    // Keep the link on screen: SMTP is optional on a self-hosted deployment,
    // and an invite nobody can reach is a seat nobody uses.
    setSentLink(result.inviteUrl ?? null);
    toast.success(
      result.emailed
        ? `Invite sent to ${email.trim()}`
        : "Invite created — copy the link to share it",
    );
    router.refresh();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invite a member</CardTitle>
        <CardDescription>
          We email them a link to join.{" "}
          {seatsLeft > 0
            ? `${seatsLeft} seat${seatsLeft === 1 ? "" : "s"} left.`
            : "No seats left on your plan."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={invite} noValidate className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email address</Label>
            <Input
              id="invite-email"
              name="email"
              type="email"
              placeholder="teammate@acme.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={pending || seatsLeft === 0}
              aria-invalid={Boolean(error)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="invite-role">Role</Label>
            <select
              id="invite-role"
              name="role"
              value={role}
              onChange={(event) =>
                setRole(event.target.value as AssignableWorkspaceRole)
              }
              disabled={pending || seatsLeft === 0}
              className="w-full rounded-lg border border-input bg-background px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:w-64"
            >
              {ASSIGNABLE_WORKSPACE_ROLES.map((assignableRole) => (
                <option key={assignableRole} value={assignableRole}>
                  {WORKSPACE_ROLE_LABELS[assignableRole]}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              {WORKSPACE_ROLE_DESCRIPTIONS[role]}
            </p>
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          {sentLink && (
            <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-2">
              <p className="min-w-0 flex-1 truncate font-mono text-xs">
                {sentLink}
              </p>
              <CopyLinkButton url={sentLink} label="invite link" />
            </div>
          )}

          <Button
            type="submit"
            disabled={pending || seatsLeft === 0 || !email.trim()}
          >
            {pending ? "Sending…" : "Send invite"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
