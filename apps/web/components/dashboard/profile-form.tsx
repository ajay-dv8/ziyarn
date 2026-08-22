"use client";

import { useState } from "react";

import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";

export function ProfileForm({
  name,
  email,
}: {
  name: string;
  email: string;
}) {
  const [displayName, setDisplayName] = useState(name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function save() {
    const trimmed = displayName.trim();
    if (!trimmed || trimmed === name) {
      setSuccess(false);
      setError(null);
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const body = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      if (!response.ok) {
        setError(body?.error?.message ?? "We could not save your profile.");
        setSaving(false);
        return;
      }
      setSuccess(true);
      setSaving(false);
    } catch {
      setError("Network error. Please try again.");
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="profile-name">Display name</Label>
        <div className="flex items-center gap-2">
          <Input
            id="profile-name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
          <Button onClick={save} disabled={saving} variant="secondary">
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="profile-email">Email</Label>
        <Input id="profile-email" value={email} disabled readOnly />
      </div>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="text-sm text-muted-foreground">Profile updated.</p>
      )}
    </div>
  );
}
