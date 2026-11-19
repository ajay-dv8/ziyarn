import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { conversationIdParamSchema } from "@repo/api/chat";

import { ConversationsPage } from "@/components/conversations/conversations-page";
import { APP_ROUTES } from "@/constants/routes";
import { authService } from "@/services/auth-service";
import { chatService } from "@/services/chat-service";
import { domainsService } from "@/services/domains-service";
import { workspaceService } from "@/services/workspace-service";

export const metadata: Metadata = {
  title: "Conversations",
};

export default async function Conversations({
  searchParams,
}: {
  searchParams: Promise<{ conversationId?: string; domainId?: string }>;
}) {
  const params = await searchParams;
  const requestHeaders = await headers();
  const session = await authService.getSession(requestHeaders);
  if (!session?.user) redirect(APP_ROUTES.SIGN_IN);

  const [domains, workspaceId] = await Promise.all([
    domainsService.listDomains(requestHeaders),
    workspaceService.getActiveWorkspaceId(requestHeaders),
  ]);

  const parsedConversationId = params.conversationId
    ? conversationIdParamSchema.safeParse(params.conversationId)
    : null;
  const conversationId = parsedConversationId?.success
    ? parsedConversationId.data
    : null;

  const requestedDomain =
    domains.find((domain) => domain.id === params.domainId) ?? null;
  const deepLinkDomainId = conversationId
    ? await chatService.getConversationDomainForOwner(
        conversationId,
        session.user.id,
      )
    : null;
  const deepLinkDomain =
    domains.find((domain) => domain.id === deepLinkDomainId) ?? null;
  const selectedDomain = deepLinkDomain ?? requestedDomain;
  const effectiveDomain =
    selectedDomain ?? (domains.length === 1 ? (domains[0] ?? null) : null);

  // A conversation deep link is the source of truth. Canonicalise the URL so
  // the sidebar, the list scope, and the open chat agree.
  if (deepLinkDomain && params.domainId !== deepLinkDomain.id) {
    const canonicalParams = new URLSearchParams({
      domainId: deepLinkDomain.id,
    });
    if (conversationId) canonicalParams.set("conversationId", conversationId);
    redirect(
      `${APP_ROUTES.DASHBOARD_CONVERSATIONS}?${canonicalParams.toString()}`,
    );
  }

  // A stale or foreign domain id should not silently fall back to domains[0].
  if (params.domainId && !requestedDomain) {
    redirect(APP_ROUTES.DASHBOARD_CONVERSATIONS);
  }

  const rows = workspaceId
    ? await chatService.listConversationsForWorkspace(
        session.user.id,
        workspaceId,
        { domainId: effectiveDomain?.id },
      )
    : [];
  const conversations = rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    ownerSeenAt: row.ownerSeenAt.toISOString(),
    lastMessage: row.lastMessage
      ? {
          ...row.lastMessage,
          createdAt: row.lastMessage.createdAt.toISOString(),
        }
      : null,
  }));

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col overflow-hidden">
      <div className="shrink-0">
        <h1 className="text-2xl font-semibold">Conversations</h1>
        <p className="text-sm text-muted-foreground">
          Chat with visitors and pick up escalations.
        </p>
        {domains.length > 1 ? (
          <nav
            aria-label="Filter conversations by domain"
            className="mt-3 flex flex-wrap gap-2"
          >
            <Link
              href={APP_ROUTES.DASHBOARD_CONVERSATIONS}
              aria-current={!effectiveDomain ? "page" : undefined}
              className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                !effectiveDomain
                  ? "border-primary bg-primary/10 font-medium text-primary"
                  : "border-input text-muted-foreground hover:text-foreground"
              }`}
            >
              All domains
            </Link>
            {domains.map((domain) => (
              <Link
                key={domain.id}
                href={`${APP_ROUTES.DASHBOARD_CONVERSATIONS}?domainId=${domain.id}`}
                aria-current={
                  effectiveDomain?.id === domain.id ? "page" : undefined
                }
                className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                  effectiveDomain?.id === domain.id
                    ? "border-primary bg-primary/10 font-medium text-primary"
                    : "border-input text-muted-foreground hover:text-foreground"
                }`}
              >
                {domain.name}
              </Link>
            ))}
          </nav>
        ) : null}
      </div>
      <div className="mt-4 min-h-0 flex-1">
        <ConversationsPage
          key={effectiveDomain?.id ?? "all-domains"}
          initial={conversations}
          initialConversationId={conversationId}
          domainId={effectiveDomain?.id ?? null}
          domainName={effectiveDomain?.name ?? null}
          showDomain={!effectiveDomain}
        />
      </div>
    </div>
  );
}
