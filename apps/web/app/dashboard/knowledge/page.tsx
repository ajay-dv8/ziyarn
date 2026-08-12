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

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Knowledge Base</h1>
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
            <CardContent>
              <KnowledgeUploadButton
                domainId={selectedDomain.id}
                agentId={selectedAgent.id}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
              <CardDescription>
                {documents.length} document(s) in this agent&apos;s knowledge
                base.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {documents.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No documents yet. Upload a PDF, TXT, Markdown, or HTML file
                  above.
                </p>
              ) : (
                <div className="space-y-2">
                  {documents.map((document) => (
                    <div
                      key={document.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-input px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {document.fileName ?? document.title ?? document.source}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {document.fileSize ? formatSize(document.fileSize) : "Pasted text"}
                          {" · "}
                          {new Date(document.createdAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {document.storageKey ? (
                          <a
                            href={`/api/knowledge/${document.id}/file?domainId=${selectedDomain.id}`}
                            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                          >
                            Download
                          </a>
                        ) : null}
                        <DeleteKnowledgeDocumentButton
                          documentId={document.id}
                          domainId={selectedDomain.id}
                        />
                      </div>
                    </div>
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