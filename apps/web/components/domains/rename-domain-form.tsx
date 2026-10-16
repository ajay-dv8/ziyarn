"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";

import { updateDomainAction, type ActionResult } from "@/lib/actions/domains";

export function RenameDomainForm({
  domainId,
  currentName,
  id,
  onSaved,
}: {
  domainId: string;
  currentName: string;
  /**
   * DOM id for the input, so a visible <label htmlFor> can name it. When
   * omitted the input falls back to its own aria-label.
   */
  id?: string;
  /** Called after a successful rename — lets a parent dialog close itself. */
  onSaved?: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(currentName);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || trimmed === currentName) return;

    setPending(true);
    setError(null);
    const result = (await updateDomainAction(domainId, {
      name: trimmed,
    })) as ActionResult;

    if (!result.ok) {
      setPending(false);
      setError(result.error);
      return;
    }

    setPending(false);
    setName(trimmed);
    router.refresh();
    onSaved?.();
  };

  return (
    <form onSubmit={onSubmit} className="flex items-center gap-2">
      <Input
        id={id}
        value={name}
        onChange={(event) => setName(event.target.value)}
        aria-label={id ? undefined : "Domain name"}
        aria-invalid={Boolean(error)}
      />
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Saving…" : "Rename"}
      </Button>
      {error && (
        <span className="text-sm text-destructive" role="alert">
          {error}
        </span>
      )}
    </form>
  );
}