"use client";

import { useRef, useState } from "react";

import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";

import { API_ROUTES } from "@/constants/routes";

export function KnowledgeUploadButton({
  domainId,
  agentId,
}: {
  domainId: string;
  agentId: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    setSuccess(null);
    try {
      const form = new FormData();
      form.append("domainId", domainId);
      form.append("agentId", agentId);
      form.append("file", file);
      const response = await fetch(API_ROUTES.KNOWLEDGE_UPLOAD, {
        method: "POST",
        body: form,
      });
      const body = (await response.json().catch(() => null)) as {
        chunkCount?: number;
        error?: { message?: string };
      } | null;
      if (!response.ok) {
        setError(body?.error?.message ?? "We could not upload the file.");
        return;
      }
      setSuccess(
        `Uploaded as ${body?.chunkCount ?? 0} knowledge chunk(s). The agent can now answer from it.`,
      );
      if (inputRef.current) inputRef.current.value = "";
      window.location.reload();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-2">
        <div className="space-y-1">
          <Label htmlFor="knowledge-file">Upload file</Label>
          <Input
            id="knowledge-file"
            ref={inputRef}
            type="file"
            accept=".pdf,.txt,.md,.html,.htm"
            disabled={uploading}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
            }}
            className="max-w-72 cursor-pointer"
          />
        </div>
        {uploading ? (
          <span className="text-sm text-muted-foreground">Embedding…</span>
        ) : null}
      </div>
      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="text-sm text-emerald-600" role="status">
          {success}
        </p>
      ) : null}
      <p className="text-xs text-muted-foreground">
        PDF, TXT, Markdown, or HTML — up to 4.45 MB. Text is extracted and embedded
        so your agent can answer from it.
      </p>
    </div>
  );
}