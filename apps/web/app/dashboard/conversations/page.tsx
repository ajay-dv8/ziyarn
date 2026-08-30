import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { ConversationsPage } from "@/components/conversations/conversations-page";
import { APP_ROUTES } from "@/constants/routes";
import { authService } from "@/services/auth-service";
import { chatService } from "@/services/chat-service";

export const metadata: Metadata = {
  title: "Conversations",
};

export default async function Conversations() {
  const session = await authService.getSession(await headers());
  if (!session?.user) redirect(APP_ROUTES.SIGN_IN);

  const rows = await chatService.listConversationsForOwner(session.user.id);
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
        <ConversationsPage initial={conversations} />
      </div>
    </div>
  );
}
