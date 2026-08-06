"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, CornerUpLeft, Send } from "lucide-react";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent } from "@repo/ui/components/card";
import { Input } from "@repo/ui/components/input";
import { ScrollArea } from "@repo/ui/components/scroll-area";
import { cn } from "@repo/ui/lib/utils";

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

export function ConversationsPage({ initial }: { initial: ConversationRow[] }) {
  const [conversations, setConversations] = useState(initial);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [lead, setLead] = useState<LeadInfo | null>(null);

  const esRef = useRef<EventSource | null>(null);
  const sinceRef = useRef<string | null>(null);
  const seenRef = useRef<Set<string>>(new Set());
  const selectedRef = useRef<string | null>(null);
  const connectRef = useRef<(since: string) => void>(() => {});
  const messagesRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  const connect = useCallback((since: string) => {
    if (!selectedRef.current) return;
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    const url =
      "/api/chat?conversationId=" +
      encodeURIComponent(selectedRef.current) +
      "&since=" +
      encodeURIComponent(since) +
      "&stream=1";
    const es = new EventSource(url);
    esRef.current = es;

    es.onmessage = (ev) => {
      let event: {
        type?: string;
        message?: MessageRow;
        serverTime?: string;
        error?: string;
      };
      try {
        event = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (event.type === "message" && event.message) {
        const m = event.message;
        seenRef.current.add(m.id);
        setMessages((prev) =>
          prev.some((x) => x.id === m.id) ? prev : [...prev, m],
        );
        sinceRef.current = m.createdAt;
        connectRef.current(m.createdAt);
        scrollToBottom();
      } else if (event.type === "done") {
        es.close();
        esRef.current = null;
        const cursor =
          typeof event.serverTime === "string" ? event.serverTime : since;
        sinceRef.current = cursor;
        setTimeout(() => connectRef.current(cursor), 100);
      } else if (event.type === "error") {
        es.close();
        esRef.current = null;
        setTimeout(() => {
          if (sinceRef.current) connectRef.current(sinceRef.current);
        }, 2000);
      }
    };

    es.onerror = () => {
      if (esRef.current !== es) return;
      es.close();
      esRef.current = null;
      setTimeout(() => {
        if (sinceRef.current) connectRef.current(sinceRef.current);
      }, 2000);
    };
  }, [scrollToBottom]);

  connectRef.current = connect;
  selectedRef.current = selectedId;

  useEffect(() => {
    const timer = setInterval(async () => {
      const res = await listConversationsAction();
      if (res.ok && res.conversations) setConversations(res.conversations);
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  async function openConversation(id: string) {
    setSelectedId(id);
    setMessages([]);
    setLead(null);
    seenRef.current = new Set();
    markConversationSeenAction({ conversationId: id });
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, unread: 0 } : c)),
    );

    const res = await fetch("/api/chat?conversationId=" + encodeURIComponent(id));
    if (res.ok) {
      const data = await res.json();
      const msgs: MessageRow[] = data.messages ?? [];
      msgs.forEach((m) => seenRef.current.add(m.id));
      setMessages(msgs);
      const last = msgs[msgs.length - 1];
      const cursor =
        last?.createdAt ??
        (typeof data.serverTime === "string" ? data.serverTime : undefined);
      if (!cursor) return;
      sinceRef.current = cursor;
      connect(cursor);
      requestAnimationFrame(scrollToBottom);
    }

    const leadRes = await getConversationLeadAction({ conversationId: id });
    if (leadRes.ok) {
      setLead(leadRes.lead ?? null);
    }
  }

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
      const m = res.message;
      seenRef.current.add(m.id);
      setMessages((prev) => [...prev, m]);
      sinceRef.current = m.createdAt;
      connect(m.createdAt);
      scrollToBottom();
    }
  }

  async function changeStatus(
    id: string,
    status: "active" | "escalated" | "resolved" | "closed",
  ) {
    const res = await setConversationStatusAction({ id, status });
    if (res.ok) {
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status } : c)),
      );
    }
  }

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <Card>
        <CardContent className="p-2">
          {conversations.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">
              No conversations yet — widget visitors appear here.
            </p>
          )}
          <ul className="space-y-1">
            {conversations.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => openConversation(c.id)}
                  className={cn(
                    "flex w-full flex-col gap-0.5 rounded-lg px-3 py-2 text-left transition-colors hover:bg-muted",
                    selectedId === c.id && "bg-muted",
                  )}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">
                      {c.title ?? c.visitorId ?? "Visitor"}
                    </span>
                    <Badge
                      variant={
                        c.status === "escalated" ? "default" : "secondary"
                      }
                    >
                      {STATUS_LABEL[c.status]}
                    </Badge>
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {c.lastMessage
                      ? c.lastMessage.content
                      : c.domainName + " · no messages yet"}
                  </span>
                  <span className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="truncate">@{c.domainSlug}</span>
                    {c.unread > 0 && (
                      <span className="ml-2 rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                        {c.unread} new
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {!selected ? (
            <div className="flex h-[60vh] items-center justify-center text-sm text-muted-foreground">
              Select a conversation to open the messenger
            </div>
          ) : (
            <div className="flex h-[60vh] flex-col">
              <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {selected.agentName
                      ? `${selected.domainName} · ${selected.agentName}`
                      : selected.domainName}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {STATUS_LABEL[selected.status]}
                    {selected.visitorId
                      ? ` · visitor ${selected.visitorId.slice(0, 8)}`
                      : ""}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  {(selected.status === "active" ||
                    selected.status === "escalated") && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => changeStatus(selected.id, "resolved")}
                      >
                        <CheckCircle2 />
                        Resolve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => changeStatus(selected.id, "closed")}
                      >
                        Close
                      </Button>
                    </>
                  )}
                  {(selected.status === "resolved" ||
                    selected.status === "closed") && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => changeStatus(selected.id, "escalated")}
                    >
                      <CornerUpLeft />
                      Reopen
                    </Button>
                  )}
                </div>
              </div>

              {lead ? (
                <div className="border-b bg-muted/40 px-4 py-2.5 text-xs">
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
                    {lead.company ? (
                      <span>{lead.company}</span>
                    ) : null}
                    {lead.interest ? (
                      <span className="capitalize">{lead.interest}</span>
                    ) : null}
                  </div>
                  {lead.answers && lead.answers.length > 0 ? (
                    <ul className="mt-1.5 space-y-1">
                      {lead.answers.map((a, index) => (
                        <li key={index}>
                          <span className="text-muted-foreground">
                            {a.question}:{" "}
                          </span>
                          <span className="text-foreground">{a.answer}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}

              <ScrollArea className="flex-1">
                <div ref={messagesRef} className="space-y-2 overflow-y-auto p-4">
                  {messages.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No messages yet.
                    </p>
                  )}
                  {messages.map((m) => (
                    <MessageBubble key={m.id} message={m} />
                  ))}
                </div>
              </ScrollArea>

              <div className="flex gap-2 border-t p-3">
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
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
