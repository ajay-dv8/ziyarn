"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import {
  ConversationServiceError,
  conversationStatusSchema,
  ownerReplySchema,
} from "@repo/api/chat";

import { authService } from "@/services/auth-service";
import { chatService } from "@/services/chat-service";

import type { ActionResult } from "./domains";

function errorResult(error: unknown): Extract<ActionResult, { ok: false }> {
  if (error instanceof ConversationServiceError) {
    return { ok: false, error: error.message };
  }
  console.error("Unexpected server action error:", error);
  return { ok: false, error: "Something went wrong, please try again" };
}

async function requireOwner() {
  const session = await authService.getSession(await headers());
  if (!session?.user) {
    throw new ConversationServiceError(401, "UNAUTHORIZED", "Not signed in");
  }
  return session.user;
}

export async function replyToConversationAction(input: {
  conversationId: string;
  message: string;
}): Promise<
  ActionResult & {
    message?: {
      id: string;
      role: string;
      sender: "visitor" | "owner" | "assistant";
      content: string;
      createdAt: string;
    };
  }
> {
  const parsed = ownerReplySchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: "Please fix the highlighted fields",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const user = await requireOwner();
    const message = await chatService.appendOwnerMessage(
      parsed.data.conversationId,
      user.id,
      parsed.data.message,
    );
    revalidatePath("/dashboard/conversations");
    return {
      ok: true,
      message: {
        id: message.id,
        role: message.role,
        sender: message.sender,
        content: message.content,
        createdAt: message.createdAt.toISOString(),
      },
    };
  } catch (error) {
    return errorResult(error);
  }
}

export async function listConversationsAction(): Promise<
  ActionResult & { conversations?: ConversationListRow[] }
> {
  try {
    const user = await requireOwner();
    const rows = await chatService.listConversationsForOwner(user.id);
    const conversations = rows.map((row) => ({
      id: row.id,
      status: row.status,
      agentName: row.agentName,
      domainSlug: row.domainSlug,
      domainName: row.domainName,
      visitorId: row.visitorId,
      title: row.title,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      ownerSeenAt: row.ownerSeenAt.toISOString(),
      unread: row.unread,
      lastMessage: row.lastMessage
        ? {
            content: row.lastMessage.content,
            sender: row.lastMessage.sender,
            createdAt: row.lastMessage.createdAt.toISOString(),
          }
        : null,
    }));
    return { ok: true, conversations };
  } catch (error) {
    return errorResult(error);
  }
}

export type ConversationListRow = {
  id: string;
  status: "active" | "escalated" | "resolved" | "closed";
  agentName: string | null;
  domainSlug: string;
  domainName: string;
  visitorId: string | null;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  ownerSeenAt: string;
  unread: number;
  lastMessage: {
    content: string;
    sender: "visitor" | "owner" | "assistant";
    createdAt: string;
  } | null;
};

export async function setConversationStatusAction(input: {
  id: string;
  status: "active" | "escalated" | "resolved" | "closed";
}): Promise<ActionResult> {
  const parsed = conversationStatusSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid conversation status" };
  }

  try {
    const user = await requireOwner();
    await chatService.setConversationStatusForOwner(
      parsed.data.id,
      user.id,
      parsed.data.status,
    );
    revalidatePath("/dashboard/conversations");
    return { ok: true };
  } catch (error) {
    return errorResult(error);
  }
}

export async function markConversationSeenAction(input: {
  conversationId: string;
}): Promise<ActionResult> {
  try {
    const user = await requireOwner();
    await chatService.markConversationSeen(input.conversationId, user.id);
    revalidatePath("/dashboard/conversations");
    return { ok: true };
  } catch (error) {
    return errorResult(error);
  }
}
