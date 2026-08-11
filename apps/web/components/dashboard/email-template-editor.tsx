"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import {
  EMAIL_BLOCK_META,
  createBlock,
  renderEmailBody,
  type EmailBlock,
  type EmailBlockKind,
} from "@repo/api/email/blocks";

type Mode = "blocks" | "html";

export type EmailTemplateDraft =
  | { kind: "blocks"; blocks: EmailBlock[] }
  | { kind: "html"; body: string };

type Props = {
  onDraft: (draft: EmailTemplateDraft) => void;
};

function updateBlock(
  blocks: EmailBlock[],
  id: string,
  patch: Partial<EmailBlock> & { id?: string },
): EmailBlock[] {
  return blocks.map((block) =>
    block.id === id ? ({ ...block, ...patch } as EmailBlock) : block,
  );
}

export function EmailTemplateEditor({ onDraft }: Props) {
  const [mode, setMode] = useState<Mode>("blocks");
  const [blocks, setBlocks] = useState<EmailBlock[]>([]);
  const [html, setHtml] = useState("");
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const dragKey = useRef<string | null>(null);

  useEffect(() => {
    onDraft(mode === "blocks" ? { kind: "blocks", blocks } : { kind: "html", body: html });
  }, [mode, blocks, html, onDraft]);

  function addBlock(kind: EmailBlockKind) {
    setBlocks((current) => [...current, createBlock(kind)]);
  }

  function moveBlock(fromId: string, toId: string | null) {
    if (toId === null || toId === fromId) return;
    setBlocks((current) => {
      const from = current.find((b) => b.id === fromId);
      if (!from) return current;
      const rest = current.filter((b) => b.id !== fromId);
      const toIndex = rest.findIndex((b) => b.id === toId);
      const next = [...rest];
      next.splice(toIndex + 1, 0, from);
      return next;
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-1">
        {(["blocks", "html"] as const).map((m) => (
          <Button
            key={m}
            type="button"
            variant={mode === m ? "default" : "outline"}
            size="sm"
            onClick={() => setMode(m)}
          >
            {m === "blocks" ? "Design" : "HTML"}
          </Button>
        ))}
      </div>

      {mode === "html" ? (
        <div className="space-y-2">
          <Label htmlFor="campaign-body">Body (HTML)</Label>
          <textarea
            id="campaign-body"
            rows={10}
            placeholder={"<p>Hi,</p><p>We have big news…</p>"}
            value={html}
            onChange={(event) => setHtml(event.target.value)}
            className="w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30"
          />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Blocks</Label>
            {EMAIL_BLOCK_META.map((meta) => (
              <button
                key={meta.kind}
                type="button"
                draggable
                onDragStart={(event) => {
                  dragKey.current = meta.kind;
                  event.dataTransfer.effectAllowed = "copy";
                }}
                onDragEnd={() => {
                  dragKey.current = null;
                  setDragOverId(null);
                }}
                onClick={() => addBlock(meta.kind)}
                className="flex w-full items-center justify-between rounded-md border border-input bg-transparent px-2.5 py-1.5 text-sm transition-colors hover:bg-accent focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none cursor-grab"
              >
                {meta.label}
                <span className="text-xs">＋</span>
              </button>
            ))}
          </div>

          <div
            className="space-y-2 rounded-lg border border-dashed p-2"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const kind = dragKey.current as EmailBlockKind | null;
              dragKey.current = null;
              setDragOverId(null);
              if (kind) addBlock(kind);
            }}
          >
            {blocks.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Drag blocks here, or click a block type to add it.
              </p>
            ) : (
              blocks.map((block) => (
                <div
                  key={block.id}
                  draggable
                  onDragStart={(event) => {
                    dragKey.current = `block:${block.id}`;
                    event.dataTransfer.effectAllowed = "move";
                  }}
                  onDragEnd={() => {
                    dragKey.current = null;
                    setDragOverId(null);
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragOverId(block.id);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    const key = dragKey.current;
                    dragKey.current = null;
                    setDragOverId(null);
                    if (key && key.startsWith("block:")) {
                      moveBlock(key.slice(6), block.id);
                    }
                  }}
                  className={`rounded-lg border bg-card p-3 ${dragOverId === block.id ? "border-primary bg-primary/5" : "border-input"} cursor-grab active:cursor-grabbing`}
                >
                  <BlockEditor
                    block={block}
                    onChange={(patch) =>
                      setBlocks((current) => updateBlock(current, block.id, patch))
                    }
                    onRemove={() =>
                      setBlocks((current) => current.filter((b) => b.id !== block.id))
                    }
                  />
                </div>
              ))
            )}
            <div
              className="flex h-10 items-center justify-center rounded-md border border-dashed border-muted text-xs text-muted-foreground"
              onDragOver={(event) => {
                event.preventDefault();
                setDragOverId("__end");
              }}
              onDrop={(event) => {
                event.preventDefault();
                const key = dragKey.current;
                dragKey.current = null;
                setDragOverId(null);
                if (key && key.startsWith("block:")) moveBlock(key.slice(6), null);
                else if (key) addBlock(key as EmailBlockKind);
              }}
            >
              Drop here to reorder
            </div>
          </div>
        </div>
      )}

      {mode === "blocks" ? (
        <div className="space-y-2">
          <Label>Preview</Label>
          <iframe
            title="Email preview"
            srcDoc={renderEmailBody(blocks)}
            className="h-64 w-full rounded-lg border border-input bg-white"
            sandbox=""
          />
        </div>
      ) : null}
    </div>
  );
}

function BlockEditor({
  block,
  onChange,
  onRemove,
}: {
  block: EmailBlock;
  onChange: (patch: Partial<EmailBlock>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs capitalize text-muted-foreground">
          {block.kind}
        </Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={onRemove}
        >
          Remove
        </Button>
      </div>
      {block.kind === "heading" ? (
        <div className="space-y-2">
          <textarea
            rows={2}
            value={block.text}
            onChange={(e) => onChange({ text: e.target.value })}
            className="w-full min-w-0 rounded-md border border-input px-2 py-1 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/40"
          />
          <div className="flex gap-1">
            {([1, 2, 3] as const).map((size) => (
              <Button
                key={size}
                type="button"
                variant={block.size === size ? "default" : "outline"}
                size="sm"
                className="h-7 w-9 px-0 text-xs"
                onClick={() => onChange({ size })}
              >
                H{size}
              </Button>
            ))}
          </div>
        </div>
      ) : null}
      {block.kind === "paragraph" ? (
        <textarea
          rows={3}
          value={block.text}
          placeholder="Write a paragraph…"
          onChange={(e) => onChange({ text: e.target.value })}
          className="w-full min-w-0 rounded-md border border-input px-2 py-1 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/40"
        />
      ) : null}
      {block.kind === "button" ? (
        <div className="space-y-2">
          <Input
            value={block.text}
            placeholder="Button label"
            onChange={(e) => onChange({ text: e.target.value })}
            className="h-7 text-sm"
          />
          <Input
            value={block.url}
            placeholder="https://… (link)"
            onChange={(e) => onChange({ url: e.target.value })}
            className="h-7 text-sm"
          />
        </div>
      ) : null}
      {block.kind === "image" ? (
        <div className="space-y-2">
          <Input
            value={block.url}
            placeholder="https://… (image)"
            onChange={(e) => onChange({ url: e.target.value })}
            className="h-7 text-sm"
          />
          <Input
            value={block.alt}
            placeholder="Alt text"
            onChange={(e) => onChange({ alt: e.target.value })}
            className="h-7 text-sm"
          />
        </div>
      ) : null}
      {block.kind === "spacer" ? (
        <div className="flex gap-1">
          {([8, 16, 24, 32] as const).map((height) => (
            <Button
              key={height}
              type="button"
              variant={block.height === height ? "default" : "outline"}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => onChange({ height })}
            >
              {height}px
            </Button>
          ))}
        </div>
      ) : null}
      {block.kind === "divider" ? (
        <p className="text-xs text-muted-foreground">Horizontal separator.</p>
      ) : null}
    </div>
  );
}