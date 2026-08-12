"use client";

import { useState } from "react";

import { Button } from "@repo/ui/components/button";

export function DeleteKnowledgeDocumentButton({
  documentId,
  domainId,
}: {
  documentId: string;
  domainId: string;
}) {
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function deleteDocument() {
    if (!window.confirm("Delete this document? The agent will stop answering from it.")) {
      return;
    }
    setState("loading");
    setError(null);
    try {
      const response = await fetch(
        `/api/knowledge/${documentId}?domainId=${domainId}`,
        { method: "DELETE" },
      );
      const body = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      if (!response.ok) {
        setError(body?.error?.message ?? "We could not delete the document.");
        setState("error");
        return;
      }
      window.location.reload();
    } catch {
      setError("Network error. Please try again.");
      setState("error");
    }
  }

  return (
    <div className="space-y-1">
      <Button
        variant="outline"
        size="sm"
        onClick={deleteDocument}
        disabled={state === "loading"}
      >
        {state === "loading" ? "Deleting…" : "Delete"}
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}