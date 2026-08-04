"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@repo/ui/components/button";

import { deleteDomainAction, type ActionResult } from "@/lib/actions/domains";

export function DeleteDomainButton({ domainId }: { domainId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDelete = async () => {
    if (!window.confirm("Delete this domain? This cannot be undone.")) return;

    setPending(true);
    setError(null);
    const result = (await deleteDomainAction(domainId)) as ActionResult;

    if (!result.ok) {
      setPending(false);
      setError(result.error);
      return;
    }

    router.refresh();
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="destructive"
        onClick={onDelete}
        disabled={pending}
      >
        {pending ? "Deleting…" : "Delete"}
      </Button>
      {error && (
        <span className="text-sm text-destructive" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
