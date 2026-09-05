"use client";

import { useEffect, useState } from "react";

import { Button } from "@repo/ui/components/button";
import { Label } from "@repo/ui/components/label";
import { RichTextEditor } from "@repo/ui/components/rich-text-editor";

type Mode = "design" | "html";

export type EmailTemplateDraft = { kind: "html"; body: string };

type Props = {
  onDraft: (draft: EmailTemplateDraft) => void;
  initialBody?: string;
};

export function EmailTemplateEditor({ onDraft, initialBody = "" }: Props) {
  const [mode, setMode] = useState<Mode>("design");
  const [body, setBody] = useState(initialBody);

  useEffect(() => {
    onDraft({ kind: "html", body });
  }, [body, onDraft]);

  return (
    <div className="space-y-3">
      <div className="flex gap-1">
        {(["design", "html"] as const).map((editorMode) => (
          <Button
            key={editorMode}
            type="button"
            variant={mode === editorMode ? "default" : "outline"}
            size="sm"
            onClick={() => setMode(editorMode)}
          >
            {editorMode === "design" ? "Design" : "HTML"}
          </Button>
        ))}
      </div>

      {mode === "design" ? (
        <div className="space-y-2">
          <Label>Body</Label>
          <RichTextEditor
            initialValue={initialBody}
            placeholder="Write your campaign…"
            onChange={setBody}
            className="rounded-lg"
          />
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="campaign-body">Body (HTML)</Label>
          <textarea
            id="campaign-body"
            rows={10}
            placeholder={"<p>Hi,</p><p>We have big news…</p>"}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            className="w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 font-mono text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
          />
        </div>
      )}
    </div>
  );
}
