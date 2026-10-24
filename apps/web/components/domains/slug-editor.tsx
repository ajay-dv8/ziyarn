"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { domainSlugSchema } from "@repo/api/domains/schemas";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";

import { updateDomainAction, type ActionResult } from "@/lib/actions/domains";

/**
 * Edits the domain's public slug.
 *
 * The slug appears in the embed snippet and in the sleek iframe URL, so a
 * change is visible to customers — but it does not disconnect live installs:
 * the chat API authenticates with the embed secret, not the slug. The copy
 * below tells the owner to refresh their snippet, which is the only real
 * follow-up.
 */
export function SlugEditor({
  domainId,
  currentSlug,
  id,
}: {
  domainId: string;
  currentSlug: string;
  /** DOM id for the input, so a visible <label htmlFor> can name it. */
  id?: string;
}) {
  const router = useRouter();
  const [slug, setSlug] = useState(currentSlug);
  /** The last saved value; compared against so "Save" disables when clean. */
  const [baseline, setBaseline] = useState(currentSlug);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const normalized = slug.trim().toLowerCase();
  const canSave = normalized.length > 0 && normalized !== baseline;

  const hintId = `${id ?? "domain-slug"}-hint`;
  const errorId = `${id ?? "domain-slug"}-error`;

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSave) return;

    const parsed = domainSlugSchema.safeParse(normalized);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid slug");
      return;
    }

    setPending(true);
    setError(null);
    setSaved(false);
    const result = (await updateDomainAction(domainId, {
      slug: parsed.data,
    })) as ActionResult;
    setPending(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setSlug(parsed.data);
    setBaseline(parsed.data);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    router.refresh();
  };

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <div className="flex items-center gap-2">
        <Input
          id={id}
          value={slug}
          onChange={(event) => {
            setSlug(event.target.value.toLowerCase());
            setError(null);
            setSaved(false);
          }}
          disabled={pending}
          aria-label="Domain slug"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : hintId}
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="font-mono"
        />
        <Button
          type="submit"
          variant="secondary"
          disabled={pending || !canSave}
          aria-label="Save slug"
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            "Save"
          )}
        </Button>
      </div>
      <p id={hintId} className="text-xs text-muted-foreground">
        3–63 characters — lowercase letters, numbers and hyphens.
      </p>
      {error && (
        <p id={errorId} className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
      {saved && (
        <p className="text-xs text-green-600" role="status">
          Saved
        </p>
      )}
    </form>
  );
}
