"use client";

import { useState } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { ChevronDown } from "lucide-react";

import { DeleteKnowledgeDocumentButton } from "@/components/dashboard/delete-knowledge-document-button";

export type KnowledgeDocumentRow = {
  id: string;
  source: string;
  title: string | null;
  fileName: string | null;
  fileSize: number | null;
  storageKey: string | null;
  createdAt: Date | string;
};

function formatSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DocumentListItem({
  document: doc,
  domainId,
  variant,
}: {
  document: KnowledgeDocumentRow;
  domainId: string;
  variant: "page" | "file";
}) {
  const primary =
    variant === "page"
      ? (doc.title ?? doc.fileName ?? doc.source)
      : (doc.fileName ?? doc.title ?? doc.source);
  const secondary = [
    variant === "page"
      ? doc.fileName
      : doc.fileSize
        ? formatSize(doc.fileSize)
        : "Pasted text",
    new Date(doc.createdAt).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-input px-3 py-2.5">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{primary}</p>
        {variant === "page" ? (
          <a
            href={doc.fileName ?? "#"}
            target="_blank"
            rel="noreferrer noopener"
            className="block max-w-full truncate text-xs text-muted-foreground hover:text-foreground hover:underline"
          >
            {doc.fileName}
          </a>
        ) : null}
        <p className="text-xs text-muted-foreground">{secondary}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {variant === "file" && doc.storageKey ? (
          <a
            href={`/api/knowledge/${doc.id}/file?domainId=${domainId}`}
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Download
          </a>
        ) : null}
        <DeleteKnowledgeDocumentButton
          documentId={doc.id}
          domainId={domainId}
        />
      </div>
    </div>
  );
}

export function CrawledPagesCard({
  crawledPages,
  domainId,
}: {
  crawledPages: KnowledgeDocumentRow[];
  domainId: string;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card>
      <CardHeader>
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          aria-expanded={expanded}
          className="flex w-full items-center justify-between text-left"
        >
          <div>
            <CardTitle>
              Pages ({crawledPages.length})
            </CardTitle>
            <CardDescription className="mt-1">
              {crawledPages.length} crawled page(s) in this agent&apos;s
              knowledge base.
            </CardDescription>
          </div>
          <ChevronDown
            className={`h-4 w-4 shrink-0 transition-transform ${
              expanded ? "" : "-rotate-90"
            }`}
          />
        </button>
      </CardHeader>
      {expanded ? (
        <CardContent>
          {crawledPages.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No pages yet. Crawl your website above to add its pages here.
            </p>
          ) : (
            <div className="space-y-2">
              {crawledPages.map((document) => (
                <DocumentListItem
                  key={document.id}
                  document={document}
                  domainId={domainId}
                  variant="page"
                />
              ))}
            </div>
          )}
        </CardContent>
      ) : null}
    </Card>
  );
}
