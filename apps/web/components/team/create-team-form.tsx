"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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

import { createTeamAction, type TeamActionResult } from "@/lib/actions/workspaces";
import { APP_ROUTES } from "@/constants/routes";

/**
 * Creates a team. The creator becomes its owner and first member, so this is
 * the only way into the team page for someone without a team — it deliberately
 * needs no domain and no plan.
 */
export function CreateTeamForm({
  canCreate,
  maxTeams,
}: {
  canCreate: boolean;
  maxTeams: number;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim()) return;

    setPending(true);
    setError(null);

    const result = (await createTeamAction({ name })) as TeamActionResult;

    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setName("");
    toast.success("Team created");
    // Land on the team just created, not on whatever was selected before.
    router.push(
      result.workspaceId
        ? `${APP_ROUTES.DASHBOARD_TEAM}?workspace=${result.workspaceId}`
        : APP_ROUTES.DASHBOARD_TEAM,
    );
    router.refresh();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create a team</CardTitle>
        <CardDescription>
          A team groups the agents, domains and knowledge bases your people work
          on. Invite them once and they can work alongside you.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="team-name">Team name</Label>
            <Input
              id="team-name"
              name="name"
              placeholder="Acme Support"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={!canCreate || pending}
              maxLength={100}
              aria-invalid={Boolean(error)}
            />
          </div>

          {!canCreate && (
            <p className="text-sm text-muted-foreground">
              Your plan allows {maxTeams} team{maxTeams === 1 ? "" : "s"}. Upgrade
              to create another.
            </p>
          )}

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={!canCreate || pending || !name.trim()}
          >
            {pending ? "Creating…" : "Create team"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
