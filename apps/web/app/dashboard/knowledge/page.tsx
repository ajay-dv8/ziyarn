import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";

import { DeleteKnowledgeDocumentButton } from "@/components/dashboard/delete-knowledge-document-button";
import { KnowledgeUploadButton } from "@/components/dashboard/knowledge-upload-button";
import { WebsiteCrawlForm } from "@/components/dashboard/website-crawl-form";
import { authService } from "@/services/auth-service";
import { agentsService } from "@/services/agents-service";
import { domainsService } from "@/services/domains-service";
import { knowledgeService } from "@/services/knowledge-service";

export const metadata: Metadata = {
  title: "Knowledge Base",
};

function formatSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type KnowledgeDocumentRow = {
  id: string;
  source: string;
  title: string | null;
  fileName: string | null;
  fileSize: number | null;
  storageKey: string | null;
  createdAt: Date | string;
};

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
        <p
          className={
            variant === "page"
              ? "text-xs text-muted-foreground"
              : "text-xs text-muted-foreground"
          }
        >
          {secondary}
        </p>
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

export default async function KnowledgePage({
  searchParams,
}: {
  searchParams: Promise<{ domainId?: string; agentId?: string }>;
}) {
  const requestHeaders = await headers();
  const session = await authService.getSession(requestHeaders);
  if (!session) {
    return null;
  }

  const domains = await domainsService.listDomains(requestHeaders);
  const { domainId, agentId } = await searchParams;
  const selectedDomain =
    domains.find((domain) => domain.id === domainId) ?? domains[0];
  const agents = selectedDomain
    ? await agentsService.listAgents(selectedDomain.id, requestHeaders)
    : [];
  const selectedAgent =
    agents.find((agent) => agent.id === agentId) ?? agents[0];
  const documents =
    selectedDomain && selectedAgent
      ? await knowledgeService.listDocuments(
          { domainId: selectedDomain.id, agentId: selectedAgent.id },
          requestHeaders,
        )
      : [];
  const crawledPages = documents.filter((doc) => doc.crawlJobId);
  const uploadedDocs = documents.filter((doc) => !doc.crawlJobId);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Knowledge Base
          </h1>
          <p className="text-sm text-muted-foreground">
            Upload files your agent answers from. Documents are embedded and
            searched by similarity at chat time.
          </p>
        </div>
      </div>

      {domains.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {domains.map((domain) => (
            <Link
              key={domain.id}
              href={`/dashboard/knowledge?domainId=${domain.id}`}
              className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                selectedDomain?.id === domain.id
                  ? "border-primary bg-primary/10 font-medium text-primary"
                  : "border-input text-muted-foreground hover:text-foreground"
              }`}
            >
              {domain.name}
            </Link>
          ))}
        </div>
      ) : null}

      {agents.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {agents.map((agent) => (
            <Link
              key={agent.id}
              href={`/dashboard/knowledge?domainId=${selectedDomain?.id}&agentId=${agent.id}`}
              className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                selectedAgent?.id === agent.id
                  ? "border-primary bg-primary/10 font-medium text-primary"
                  : "border-input text-muted-foreground hover:text-foreground"
              }`}
            >
              {agent.name}
            </Link>
          ))}
        </div>
      ) : null}

      {!selectedDomain || !selectedAgent ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <p className="text-sm font-medium">No agent configured</p>
            <p className="text-sm text-muted-foreground">
              Create a domain and an agent first, then upload documents here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Upload</CardTitle>
              <CardDescription>
                {selectedAgent.name} will answer from these files.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* KNOWLEDGE UPLOAD */}
              <KnowledgeUploadButton
                domainId={selectedDomain.id}
                agentId={selectedAgent.id}
              />
              <div className="border-t pt-6">
                {/* Document list */}
                <Card>
                  <CardHeader>
                    <CardTitle>Documents</CardTitle>
                    <CardDescription>
                      {uploadedDocs.length} document(s) in this agent&apos;s
                      knowledge base.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {uploadedDocs.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No documents yet. Upload a PDF, TXT, Markdown, or HTML
                        file above.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {uploadedDocs.map((document) => (
                          <DocumentListItem
                            key={document.id}
                            document={document}
                            domainId={selectedDomain.id}
                            variant="file"
                          />
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>

          <Card>
            {/* WEBSITE CRAWL FORM */}
            <div className="p-6 border-b ">
              <WebsiteCrawlForm
              domainId={selectedDomain.id}
              agentId={selectedAgent.id}
            />
            </div>
            <CardHeader>
              <CardTitle>Pages</CardTitle>
              <CardDescription>
                {crawledPages.length} crawled page(s) in this agent&apos;s
                knowledge base.
              </CardDescription>
            </CardHeader>
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
                      domainId={selectedDomain.id}
                      variant="page"
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
