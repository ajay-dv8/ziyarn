"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, Clock, CornerUpLeft, Send } from "lucide-react";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent } from "@repo/ui/components/card";
import { Input } from "@repo/ui/components/input";
import { ScrollArea } from "@repo/ui/components/scroll-area";
import { cn } from "@repo/ui/lib/utils";

import { formatFullDateTime, formatRelativeTime } from "@/lib/utils";

import {
  getConversationLeadAction,
  listConversationsAction,
  markConversationSeenAction,
  replyToConversationAction,
  setConversationStatusAction,
  type ConversationListRow,
  type LeadInfo,
} from "@/lib/actions/conversations";

type ConversationRow = ConversationListRow;

type MessageRow = {
  id: string;
  role: string;
  sender: "visitor" | "owner" | "assistant";
  content: string;
  createdAt: string;
};

const STATUS_LABEL: Record<ConversationRow["status"], string> = {
  active: "Active",
  escalated: "Escalated",
  resolved: "Resolved",
  closed: "Closed",
};

/**
 * ConversationsPage — two-panel layout for managing live chat conversations.
 * Left panel: scrollable list of all conversations with status badges.
 * Right panel: messenger view with real-time SSE streaming, lead info, and reply input.
 * Layout fills the parent container (h-full) so scrolling is handled per-panel, not the page.
 */
export function ConversationsPage({ initial }: { initial: ConversationRow[] }) {
  const [conversations, setConversations] = useState(initial);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [lead, setLead] = useState<LeadInfo | null>(null);

  // Refs for EventSource SSE connection and cursor tracking
  const eventSourceRef = useRef<EventSource | null>(null);
  const sinceCursorRef = useRef<string | null>(null);
  const seenMessageIdsRef = useRef<Set<string>>(new Set());
  const selectedConversationRef = useRef<string | null>(null);
  const connectRef = useRef<(since: string) => void>(() => {});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  /** Scroll the messages container to the bottom */
  const scrollToBottom = useCallback(() => {
    const el = messagesEndRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  /**
   * Open an SSE connection to receive real-time messages for the selected conversation.
   * Uses a polling pattern: server holds connection up to ~8s, pushes messages, closes.
   * Client reconnects immediately on close/error with the latest cursor position.
   */
  const connect = useCallback((since: string) => {
    if (!selectedConversationRef.current) return;
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    const url =
      "/api/chat?conversationId=" +
      encodeURIComponent(selectedConversationRef.current) +
      "&since=" +
      encodeURIComponent(since) +
      "&stream=1";
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      let parsed: {
        type?: string;
        message?: MessageRow;
        serverTime?: string;
        error?: string;
      };
      try {
        parsed = JSON.parse(event.data);
      } catch {
        return;
      }
      if (parsed.type === "message" && parsed.message) {
        const incomingMessage = parsed.message;
        seenMessageIdsRef.current.add(incomingMessage.id);
        // Deduplicate by id before appending
        setMessages((prev) =>
          prev.some((existing) => existing.id === incomingMessage.id)
            ? prev
            : [...prev, incomingMessage],
        );
        sinceCursorRef.current = incomingMessage.createdAt;
        // Reconnect with updated cursor for next batch
        connectRef.current(incomingMessage.createdAt);
        scrollToBottom();
      } else if (parsed.type === "done") {
        eventSource.close();
        eventSourceRef.current = null;
        // Use server-provided timestamp to avoid client clock skew
        const cursor =
          typeof parsed.serverTime === "string"
            ? parsed.serverTime
            : since;
        sinceCursorRef.current = cursor;
        setTimeout(() => connectRef.current(cursor), 100);
      } else if (parsed.type === "error") {
        eventSource.close();
        eventSourceRef.current = null;
        setTimeout(() => {
          if (sinceCursorRef.current)
            connectRef.current(sinceCursorRef.current);
        }, 2000);
      }
    };

    eventSource.onerror = () => {
      if (eventSourceRef.current !== eventSource) return;
      eventSource.close();
      eventSourceRef.current = null;
      setTimeout(() => {
        if (sinceCursorRef.current)
          connectRef.current(sinceCursorRef.current);
      }, 2000);
    };
  }, [scrollToBottom]);

  // Keep refs in sync with current state (stable callback pattern)
  connectRef.current = connect;
  selectedConversationRef.current = selectedId;

  // Poll conversation list every 10s for unread badge updates
  useEffect(() => {
    const timer = setInterval(async () => {
      const res = await listConversationsAction();
      if (res.ok && res.conversations) setConversations(res.conversations);
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  /** Load conversation history and open SSE stream */
  async function openConversation(conversationId: string) {
    setSelectedId(conversationId);
    setMessages([]);
    setLead(null);
    seenMessageIdsRef.current = new Set();
    markConversationSeenAction({ conversationId });
    // Optimistically clear unread badge
    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === conversationId ? { ...conv, unread: 0 } : conv,
      ),
    );

    // Fetch full message history
    const res = await fetch(
      "/api/chat?conversationId=" + encodeURIComponent(conversationId),
    );
    if (res.ok) {
      const data = await res.json();
      const history: MessageRow[] = data.messages ?? [];
      history.forEach((msg) => seenMessageIdsRef.current.add(msg.id));
      setMessages(history);
      // Set cursor to last message or server time for SSE reconnect
      const lastMessage = history[history.length - 1];
      const cursor =
        lastMessage?.createdAt ??
        (typeof data.serverTime === "string" ? data.serverTime : undefined);
      if (!cursor) return;
      sinceCursorRef.current = cursor;
      connect(cursor);
      requestAnimationFrame(scrollToBottom);
    }

    // Fetch lead info (filter question answers) for this conversation
    const leadRes = await getConversationLeadAction({ conversationId });
    if (leadRes.ok) {
      setLead(leadRes.lead ?? null);
    }
  }

  /** Send an owner reply to the current conversation */
  async function sendReply() {
    const text = draft.trim();
    if (!text || !selectedId || busy) return;
    setBusy(true);
    const res = await replyToConversationAction({
      conversationId: selectedId,
      message: text,
    });
    setBusy(false);
    if (res.ok && res.message) {
      setDraft("");
      const sentMessage = res.message;
      seenMessageIdsRef.current.add(sentMessage.id);
      setMessages((prev) => [...prev, sentMessage]);
      sinceCursorRef.current = sentMessage.createdAt;
      connect(sentMessage.createdAt);
      scrollToBottom();
    }
  }

  /** Update conversation status (resolve, close, reopen) */
  async function changeStatus(
    conversationId: string,
    status: "active" | "escalated" | "resolved" | "closed",
  ) {
    const res = await setConversationStatusAction({
      id: conversationId,
      status,
    });
    if (res.ok) {
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === conversationId ? { ...conv, status } : conv,
        ),
      );
    }
  }

  const selectedConversation =
    conversations.find((conv) => conv.id === selectedId) ?? null;

  return (
    <div className="grid h-full gap-4 lg:grid-cols-[320px_1fr]">
      {/* Left panel — conversation list */}
      <Card className={cn("flex min-h-0 flex-col overflow-hidden", selectedId && "hidden", "lg:flex")}>
        <CardContent className="flex min-h-0 flex-1 flex-col p-2">
          {conversations.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">
              No conversations yet — widget visitors appear here.
            </p>
          )}
          <ScrollArea className="min-h-0 flex-1">
            <ul className="space-y-1">
              {conversations.map((conversation) => (
                <li key={conversation.id}>
                  <button
                    type="button"
                    onClick={() => openConversation(conversation.id)}
                    className={cn(
                      "flex w-full flex-col gap-0.5 rounded-lg px-3 py-2 text-left transition-colors hover:bg-muted",
                      selectedId === conversation.id && "bg-muted",
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">
                        {conversation.title ??
                          conversation.visitorId ??
                          "Visitor"}
                      </span>
                      <Badge
                        variant={
                          conversation.status === "escalated"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {STATUS_LABEL[conversation.status]}
                      </Badge>
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {conversation.lastMessage
                        ? conversation.lastMessage.content
                        : conversation.domainName + " · no messages yet"}
                    </span>
                    <span className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="truncate">
                        @{conversation.domainSlug}
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        {conversation.unread > 0 && (
                          <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                            {conversation.unread} new
                          </span>
                        )}
                        <span className="flex items-center gap-0.5">
                          <Clock className="h-3 w-3" />
                          {formatRelativeTime(conversation.createdAt)}
                        </span>
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Right panel — messenger */}
      <Card className={cn("flex min-h-0 flex-col overflow-hidden", !selectedId && "hidden", "lg:flex")}>
        <CardContent className="flex min-h-0 flex-1 flex-col p-0">
          {!selectedConversation ? (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              Select a conversation to open the messenger
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              {/* Conversation header — agent info + status actions */}
              <div className="flex shrink-0 items-center gap-2 border-b px-4 py-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 lg:hidden"
                  onClick={() => setSelectedId(null)}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {selectedConversation.agentName
                      ? `${selectedConversation.domainName} · ${selectedConversation.agentName}`
                      : selectedConversation.domainName}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {lead?.name ?? lead?.email
                      ? lead.name ?? lead.email
                      : selectedConversation.visitorId
                        ? `visitor ${selectedConversation.visitorId.slice(0, 8)}`
                        : "Unknown visitor"}
                    {" · "}
                    {formatFullDateTime(selectedConversation.createdAt)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Badge
                    variant={
                      selectedConversation.status === "escalated"
                        ? "default"
                        : "secondary"
                    }
                  >
                    {STATUS_LABEL[selectedConversation.status]}
                  </Badge>
                  {(selectedConversation.status === "active" ||
                    selectedConversation.status === "escalated") && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          changeStatus(selectedConversation.id, "resolved")
                        }
                      >
                        <CheckCircle2 />
                        Resolve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          changeStatus(selectedConversation.id, "closed")
                        }
                      >
                        Close
                      </Button>
                    </>
                  )}
                  {(selectedConversation.status === "resolved" ||
                    selectedConversation.status === "closed") && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        changeStatus(selectedConversation.id, "escalated")
                      }
                    >
                      <CornerUpLeft />
                      Reopen
                    </Button>
                  )}
                </div>
              </div>

              {/* Lead info — captured from filter questions + email */}
              {lead ? (
                <div className="shrink-0 border-b bg-muted/40 px-4 py-2.5 text-xs">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {lead.name ?? "Lead"}
                    </span>
                    {lead.email ? (
                      <a
                        href={`mailto:${lead.email}`}
                        className="underline underline-offset-2 hover:text-foreground"
                      >
                        {lead.email}
                      </a>
                    ) : null}
                    {lead.company ? <span>{lead.company}</span> : null}
                    {lead.interest ? (
                      <span className="capitalize">{lead.interest}</span>
                    ) : null}
                  </div>
                  {lead.answers && lead.answers.length > 0 ? (
                    <ul className="mt-1.5 space-y-1">
                      {lead.answers.map((answer, index) => (
                        <li key={index}>
                          <span className="text-muted-foreground">
                            {answer.question}:{" "}
                          </span>
                          <span className="text-foreground">
                            {answer.answer}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}

              {/* Messages — scrollable chat area */}
              <ScrollArea className="min-h-0 flex-1">
                <div ref={messagesEndRef} className="space-y-2 p-4">
                  {messages.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No messages yet.
                    </p>
                  )}
                  {messages.map((msg) => (
                    <MessageBubble key={msg.id} message={msg} />
                  ))}
                </div>
              </ScrollArea>

              {/* Reply input */}
              <div className="flex shrink-0 gap-2 border-t p-3">
                <Input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      sendReply();
                    }
                  }}
                  placeholder="Reply as the business…"
                  disabled={busy}
                />
                <Button onClick={sendReply} disabled={busy || !draft.trim()}>
                  <Send />
                  Send
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * MessageBubble — renders a single chat message.
 * Visitor messages align right (primary bg), owner messages align left (bordered),
 * assistant messages align left (bordered, neutral).
 */
function MessageBubble({ message }: { message: MessageRow }) {
  const align = message.sender === "visitor" ? "flex-end" : "flex-start";
  return (
    <div className="flex" style={{ justifyContent: align }}>
      <div
        className={cn(
          "max-w-[75%] rounded-xl px-3 py-2 text-sm",
          message.sender === "visitor" &&
            "bg-primary text-primary-foreground",
          message.sender === "owner" &&
            "border border-primary bg-background",
          message.sender === "assistant" &&
            "border border-border bg-background",
        )}
      >
        {message.sender === "owner" && (
          <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
            You
          </p>
        )}
        <p className="whitespace-pre-wrap wrap-break-word">{message.content}</p>
        <p className="mt-1 text-[10px] opacity-60">
          {new Date(message.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
}
