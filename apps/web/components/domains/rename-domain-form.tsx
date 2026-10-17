"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil } from "lucide-react";

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
      {/* Icon rather than a word: the field is always editable, so the section
          heading already says what this is, and a button reading "Rename" next
          to an input you can type in is redundant. The label is still on the
          button for anyone not looking at the icon. */}
      <Button
        type="submit"
        variant="secondary"
        size="icon"
        disabled={pending}
        aria-label="Rename domain"
        title="Rename domain"
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Pencil className="size-4" aria-hidden="true" />
        )}
      </Button>
      {error && (
        <span className="text-sm text-destructive" role="alert">
          {error}
        </span>
      )}
    </form>
  );
}