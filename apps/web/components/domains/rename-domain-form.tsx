"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";

import { updateDomainAction, type ActionResult } from "@/lib/actions/domains";

export function RenameDomainForm({
  domainId,
  currentName,
}: {
  domainId: string;
  currentName: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(currentName);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed === currentName) return;

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

    router.refresh();
  };

  return (
    <form onSubmit={onSubmit} className="flex items-center gap-2">
      <Input
        value={name}
        onChange={(event) => setName(event.target.value)}
        aria-label="Domain name"
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
