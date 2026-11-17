import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { ConversationsPage } from "@/components/conversations/conversations-page";
import { APP_ROUTES } from "@/constants/routes";
import { authService } from "@/services/auth-service";
import { chatService } from "@/services/chat-service";
import { workspaceService } from "@/services/workspace-service";

export const metadata: Metadata = {
  title: "Conversations",
};

export default async function Conversations({
  searchParams,
}: {
  searchParams: Promise<{ conversationId?: string }>;
}) {
  const params = await searchParams;
  const requestHeaders = await headers();
  const session = await authService.getSession(requestHeaders);
  if (!session?.user) redirect(APP_ROUTES.SIGN_IN);

  const workspaceId = await workspaceService.getActiveWorkspaceId(
    requestHeaders,
  );
  const rows = workspaceId
    ? await chatService.listConversationsForWorkspace(
        session.user.id,
        workspaceId,
      )
    : [];
  const conversations = rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    ownerSeenAt: row.ownerSeenAt.toISOString(),
    lastMessage: row.lastMessage
      ? { ...row.lastMessage, createdAt: row.lastMessage.createdAt.toISOString() }
      : null,
  }));

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col overflow-hidden">
      <div className="shrink-0">
        <h1 className="text-2xl font-semibold">Conversations</h1>
        <p className="text-sm text-muted-foreground">
          Chat with visitors who escalated to a human.
        </p>
      </div>
      <div className="mt-4 min-h-0 flex-1">
        <ConversationsPage
          initial={conversations}
          initialConversationId={params.conversationId ?? null}
        />
      </div>
    </div>
  );
}
