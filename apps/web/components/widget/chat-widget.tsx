"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { type ReactNode } from "react";
import {
  ArrowUp,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Maximize2,
  Mic,
  Minimize2,
  Plus,
  SlidersHorizontal,
  Smile,
  Sparkles,
  Sprout,
  Terminal,
  User,
  X,
} from "lucide-react";

import { cn } from "@repo/ui/lib/utils";
import {
  createSession,
  type HistoryResponse,
  type OwnerReply,
  type Session,
} from "@repo/widget-core";

/**
 * Modern Sleek — the third widget surface.
 *
 * The chat itself runs on @repo/widget-core, the same session/transport used by
 * the Shadow DOM variants. This component is only the view: it is mounted by
 * the dashboard preview and by /embed/[slug], the page customers frame.
 *
 * `mode="demo"` keeps the seeded conversation used by /widget-preview, so the
 * design can still be reviewed without a domain secret.
 */

export type ChatWidgetMode = "demo" | "preview" | "embed";

type ToolActivity = {
  name: string;
  detail?: string;
  /** The reference conversation's Python card, only used by the demo. */
  demo?: boolean;
};

type ChatMessage = {
  id: string;
  role: "assistant" | "user" | "owner";
  text: string;
  tool?: ToolActivity;
  error?: string;
};

type Status = "loading" | "ready" | "error" | "unavailable";

const GREETING = "Hello! How can I help you today?";

const DEMO_TOOL_CODE =
  '{"code_str":"import pandas as pd\\n# Load the workbook sheet\\ndf = pd.read_excel(\'sales.xlsx\')"}';

const DEMO_MESSAGES: ChatMessage[] = [
  {
    id: "greeting",
    role: "assistant",
    text: "Hello! How can I help you analyze your data today?",
  },
  {
    id: "question",
    role: "user",
    text: "Show me revenue trends for the last quarter",
  },
  {
    id: "working",
    role: "assistant",
    text: "Okay, let me cook...",
    tool: {
      name: "Python Analysis",
      detail: DEMO_TOOL_CODE,
      demo: true,
    },
  },
];

export type ChatWidgetProps = {
  className?: string;
  mode?: ChatWidgetMode;
  slug?: string;
  secret?: string;
  /** Empty string means same-origin, which is right for the dashboard and iframe. */
  apiBase?: string;
  /**
   * Refuse to render if the domain's plan no longer includes Modern Sleek.
   * Off in the dashboard preview so an owner can see what they could upgrade to.
   */
  enforcePlan?: boolean;
  /** Present in iframe mode: asks the host page to hide the frame. */
  onClose?: () => void;
};

export function ChatWidget({
  className,
  mode = "demo",
  slug,
  secret,
  apiBase = "",
  enforcePlan = false,
  onClose,
}: ChatWidgetProps) {
  const isDemo = mode === "demo";
  const isPreview = mode === "preview";

  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    isDemo ? DEMO_MESSAGES : [],
  );
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(isDemo);
  const [activeId, setActiveId] = useState<string | null>(
    isDemo ? "working" : null,
  );
  const [status, setStatus] = useState<Status>(isDemo ? "ready" : "loading");
  const [statusMessage, setStatusMessage] = useState(
    "Connecting to the agent…",
  );
  const [placeholder, setPlaceholder] = useState("Ask anything...");
  const [agentName, setAgentName] = useState<string | null>(null);
  const [escalated, setEscalated] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const sessionRef = useRef<Session | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);
  const stopped = useRef(false);
  const seenOwnerMessages = useRef<Set<string>>(new Set());

  const patchMessage = useCallback(
    (id: string, patch: (message: ChatMessage) => ChatMessage) => {
      setMessages((current) =>
        current.map((message) =>
          message.id === id ? patch(message) : message,
        ),
      );
    },
    [],
  );

  const appendOwnerMessage = useCallback((message: OwnerReply) => {
    const text = message.content?.trim();
    if (!text) return;

    const key = `${message.createdAt ?? ""}:${text}`;
    if (seenOwnerMessages.current.has(key)) return;
    seenOwnerMessages.current.add(key);

    setMessages((current) => [
      ...current,
      {
        id: `owner-${nextId.current++}`,
        role: message.sender === "agent" ? "assistant" : "owner",
        text,
      },
    ]);
  }, []);

  useEffect(() => {
    if (isDemo) return undefined;

    if (!slug || !secret) {
      setStatus("error");
      setStatusMessage("This chat link is missing its key.");
      return undefined;
    }

    let cancelled = false;
    setStatus("loading");
    setStatusMessage("Connecting to the agent…");

    const session = createSession({ apiBase, secret, slug });
    sessionRef.current = session;

    void (async () => {
      try {
        const config = await session.loadConfig();
        if (cancelled) return;

        if (config.agent?.name) setAgentName(config.agent.name);
        const configuredPlaceholder = config.placeholders?.find((value) =>
          value.trim(),
        );
        if (configuredPlaceholder) setPlaceholder(configuredPlaceholder);

        if (enforcePlan && config.widgetVariant !== "sleek") {
          setStatus("unavailable");
          setStatusMessage(
            "This chat style isn't available on this site right now.",
          );
          return;
        }

        // A history failure is not fatal: the visitor still gets a live chat,
        // just without their earlier messages.
        let history: HistoryResponse | null = null;
        try {
          history = await session.loadHistory();
        } catch {
          history = null;
        }
        if (cancelled) return;

        const saved = history
          ? historyToMessages(history, seenOwnerMessages.current)
          : [];
        setMessages(
          saved.length > 0
            ? saved
            : [{ id: "greeting", role: "assistant", text: GREETING }],
        );
        setStatus("ready");
        session.listenForOwnerReplies({ onMessage: appendOwnerMessage });
      } catch {
        if (cancelled) return;
        setStatus("error");
        setStatusMessage(
          "We couldn't load this chat. Please try again later.",
        );
      }
    })();

    return () => {
      cancelled = true;
      session.stopListening();
      session.stop();
      if (sessionRef.current === session) sessionRef.current = null;
    };
  }, [
    apiBase,
    appendOwnerMessage,
    attempt,
    enforcePlan,
    isDemo,
    secret,
    slug,
  ]);

  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (mode === "embed" && status === "ready") inputRef.current?.focus();
  }, [mode, status]);

  useEffect(() => {
    if (!onClose) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const stop = () => {
    if (isDemo) {
      setStreaming(false);
      setActiveId(null);
      return;
    }
    stopped.current = true;
    sessionRef.current?.stop();
  };

  const sendDemo = () => {
    const text = draft.trim();
    if (!text) return;

    setDraft("");
    setStreaming(false);
    setActiveId(null);
    setMessages((current) => [
      ...current,
      { id: `user-${nextId.current++}`, role: "user", text },
      {
        id: `assistant-${nextId.current++}`,
        role: "assistant",
        text: "Got it. I would pull that from your connected data next.",
      },
    ]);
  };

  const sendReal = async () => {
    const text = draft.trim();
    const session = sessionRef.current;
    if (!text || streaming || status !== "ready" || !session) return;

    setDraft("");
    setEscalated(false);
    stopped.current = false;

    const userId = `user-${nextId.current++}`;
    const replyId = `assistant-${nextId.current++}`;
    setMessages((current) => [
      ...current,
      { id: userId, role: "user", text },
      { id: replyId, role: "assistant", text: "" },
    ]);
    setStreaming(true);
    setActiveId(replyId);

    await session.send(text, {
      onDelta: (delta) =>
        patchMessage(replyId, (message) => ({
          ...message,
          text: message.text + delta,
        })),
      onTool: (name, args) =>
        patchMessage(replyId, (message) => ({
          ...message,
          tool: { name: toolLabel(name), detail: toolDetail(args) },
        })),
      onEscalate: () => setEscalated(true),
      onDone: () => {},
      onError: (errorMessage) =>
        patchMessage(replyId, (message) => ({
          ...message,
          error: errorMessage,
        })),
    });

    setStreaming(false);
    setActiveId(null);
    patchMessage(replyId, (message) => {
      if (
        message.text.trim() ||
        message.tool ||
        message.error
      ) {
        return message;
      }
      return {
        ...message,
        text: stopped.current
          ? "Stopped."
          : "I'm sorry, I couldn't generate a reply.",
      };
    });
    if (sessionRef.current === session) {
      session.listenForOwnerReplies({ onMessage: appendOwnerMessage });
    }
  };

  const send = () => {
    if (streaming) return;
    if (isDemo) {
      sendDemo();
      return;
    }
    void sendReal();
  };

  const composerWidth = isPreview
    ? "w-full max-w-[410px]"
    : "w-[min(88vw,410px)]";

  return (
    <div className={cn("flex w-full flex-col items-center", className)}>
      <div
        role="region"
        aria-label={agentName ? `Chat with ${agentName}` : "Chat with the assistant"}
        className={cn(
          "relative flex flex-col overflow-hidden rounded-[20px] border border-white/70",
          "bg-[radial-gradient(120%_110%_at_32%_58%,#efe5ff_0%,#f7f4fb_48%,#f3f1f6_100%)]",
          "shadow-[0_36px_90px_-24px_rgba(8,6,18,0.78)]",
          "transition-[width,height] duration-300 ease-out",
          expanded
            ? "h-[min(88dvh,760px)] w-[min(94vw,860px)]"
            : isPreview
              ? "h-[420px] w-full max-w-[520px]"
              : "h-[min(68dvh,450px)] w-[min(92vw,520px)]",
        )}
      >
        {/* Soft lavender bloom behind the conversation, like the reference. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-[34%] -left-24 size-80 rounded-full bg-[#c9b4f8]/50 blur-[72px]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 bottom-6 size-44 rounded-full bg-[#e8ddff]/35 blur-[60px]"
        />

        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close chat"
            className="absolute top-3 right-3 z-20 grid size-8 place-items-center rounded-full bg-white/75 text-[#494652] shadow-[0_6px_18px_-6px_rgba(23,22,27,0.3)] backdrop-blur transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17161b]/20"
          >
            <X className="size-4" strokeWidth={2} />
          </button>
        ) : null}

        {status === "ready" ? (
          <div
            ref={scrollRef}
            className={cn(
              "relative flex-1 overflow-y-auto overscroll-contain px-5 pt-5 sm:px-6 sm:pt-6",
              onClose && "pr-12 sm:pr-14",
              isPreview ? "pb-5" : "pb-16",
            )}
          >
            <div
              role="log"
              aria-live="polite"
              aria-label="Conversation"
              className="space-y-[18px]"
            >
              {messages.map((message) =>
                message.role === "user" ? (
                  <UserMessage key={message.id} text={message.text} />
                ) : (
                  <AssistantMessage
                    key={message.id}
                    message={message}
                    running={message.id === activeId}
                  />
                ),
              )}
              {escalated ? (
                <p className="text-[11px] leading-[1.5] text-[#8a5a00]">
                  A teammate has been notified and will reply here.
                </p>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="relative flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
            {status === "loading" ? <AssistantAvatar running /> : null}
            <p className="text-[13px] leading-[1.55] text-[#4c4954]">
              {statusMessage}
            </p>
            {status === "error" ? (
              <button
                type="button"
                onClick={() => setAttempt((value) => value + 1)}
                className="rounded-lg bg-white px-3 py-1.5 text-[11px] font-medium text-[#494652] shadow-[0_10px_24px_-8px_rgba(23,22,27,0.16)] transition hover:shadow-[0_12px_28px_-8px_rgba(23,22,27,0.24)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17161b]/20"
              >
                Try again
              </button>
            ) : null}
          </div>
        )}

        {!isPreview ? (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-label={expanded ? "Exit full screen" : "Open full screen"}
            className="absolute right-4 bottom-4 inline-flex h-8 items-center gap-1.5 rounded-lg bg-white px-3 text-[11px] font-medium text-[#494652] shadow-[0_10px_24px_-8px_rgba(23,22,27,0.16)] transition hover:shadow-[0_12px_28px_-8px_rgba(23,22,27,0.24)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17161b]/20"
          >
            {expanded ? (
              <Minimize2 className="size-3.5" strokeWidth={2.2} />
            ) : (
              <Maximize2 className="size-3.5" strokeWidth={2.2} />
            )}
            {expanded ? "Exit Full Screen" : "Full Screen"}
          </button>
        ) : null}
      </div>

      <div
        className={cn(
          "mt-3 flex items-center gap-0.5 rounded-full border border-white/50 bg-[#e8e5eb]/95 p-1.5 shadow-[0_24px_60px_-18px_rgba(0,0,0,0.7)] backdrop-blur-md",
          composerWidth,
        )}
      >
        <ComposerIcon label="Add attachment">
          <Plus className="size-4" strokeWidth={2} />
        </ComposerIcon>
        <ComposerIcon label="Recent chats">
          <Clock className="size-4" strokeWidth={2} />
        </ComposerIcon>

        <input
          ref={inputRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              send();
            }
          }}
          placeholder={placeholder}
          aria-label="Ask anything"
          autoComplete="off"
          disabled={status !== "ready"}
          className="min-w-0 flex-1 bg-transparent px-1.5 text-[12.5px] text-[#1b1a20] outline-none placeholder:text-[#8f8b97]"
        />

        <ComposerIcon label="Voice input">
          <Mic className="size-4" strokeWidth={2} />
        </ComposerIcon>
        <ComposerIcon label="Prompt suggestions">
          <Sparkles className="size-4" strokeWidth={2} />
        </ComposerIcon>

        <button
          type="button"
          onClick={streaming ? stop : send}
          disabled={
            status !== "ready" || (!streaming && !draft.trim())
          }
          aria-label={streaming ? "Stop response" : "Send message"}
          className="grid size-8 shrink-0 place-items-center rounded-full bg-[#0d0c11] text-white shadow-sm transition hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17161b]/30 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {streaming ? (
            <span
              aria-hidden="true"
              className="block size-2.5 rounded-[2px] bg-white"
            />
          ) : (
            <ArrowUp className="size-4" strokeWidth={2.2} />
          )}
        </button>

        <ComposerIcon label="Composer settings">
          <SlidersHorizontal className="size-4" strokeWidth={2} />
        </ComposerIcon>
      </div>
    </div>
  );
}

function historyToMessages(
  history: HistoryResponse,
  seenOwnerMessages: Set<string>,
): ChatMessage[] {
  const messages: ChatMessage[] = [];
  let index = 0;

  for (const entry of history.messages ?? []) {
    const text = entry.content?.trim();
    if (!text) continue;

    const id = `history-${index++}`;

    if (entry.sender === "owner" || entry.sender === "agent") {
      seenOwnerMessages.add(`${entry.createdAt ?? ""}:${text}`);
      messages.push({
        id,
        role: entry.sender === "agent" ? "assistant" : "owner",
        text,
      });
      continue;
    }

    if (entry.sender === "visitor" || entry.role === "user") {
      messages.push({ id, role: "user", text });
      continue;
    }

    if (entry.role === "assistant") {
      messages.push({ id, role: "assistant", text });
    }
  }

  return messages;
}

function toolLabel(name: string): string {
  const labels: Record<string, string> = {
    answer_knowledge: "Knowledge Search",
    book_appointment: "Appointment Booking",
    create_payment: "Payment Link",
    sell_product: "Product Lookup",
    escalate: "Human Handoff",
  };

  return (
    labels[name] ??
    name
      .replace(/_/g, " ")
      .replace(/\b\w/g, (character) => character.toUpperCase())
  );
}

function toolDetail(args?: Record<string, unknown>): string | undefined {
  if (!args) return undefined;

  const code =
    typeof args.code_str === "string"
      ? args.code_str
      : typeof args.code === "string"
        ? args.code
        : null;
  if (code) return code;

  const entries = Object.entries(args).filter(
    ([, value]) => value !== undefined && value !== null,
  );
  if (entries.length === 0) return undefined;

  try {
    return JSON.stringify(Object.fromEntries(entries), null, 2);
  } catch {
    return undefined;
  }
}

function AssistantMessage({
  message,
  running,
}: {
  message: ChatMessage;
  running: boolean;
}) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-start gap-3">
        <AssistantAvatar running={running} />
        <div className="min-w-0 pt-0.5">
          {message.text ? (
            <p className="text-[13px] leading-[1.55] text-[#1a1920]">
              {message.text}
            </p>
          ) : running ? (
            <p className="text-[13px] leading-[1.55] text-[#8f8b97] italic">
              Working…
            </p>
          ) : null}
          {message.error ? (
            <p className="mt-1 text-[11px] leading-[1.45] text-[#b3261e]">
              {message.error}
            </p>
          ) : null}
          <p className="mt-1 text-[9.5px] font-medium tracking-wide text-[#9c99a5]">
            {message.role === "owner" ? "Team" : "Powered by AI"}
          </p>
        </div>
      </div>
      {message.tool ? (
        <div className="ml-11">
          <ToolCard tool={message.tool} running={running} />
        </div>
      ) : null}
    </div>
  );
}

function UserMessage({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-end gap-2.5">
      <div className="max-w-[76%] rounded-[11px] bg-[#0e0d12] px-3.5 py-2.5 text-[12.5px] leading-[1.45] text-white shadow-[0_4px_14px_rgba(0,0,0,0.18)]">
        {text}
      </div>
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#0d0d10] text-white ring-1 ring-black/10">
        <User className="size-[15px]" strokeWidth={2} />
      </span>
    </div>
  );
}

function AssistantAvatar({ running }: { running: boolean }) {
  if (running) {
    return (
      <span className="relative grid size-8 shrink-0 place-items-center rounded-full bg-[#3fcf6e] text-[#0c5a2d] ring-1 ring-black/5">
        <Smile className="size-4" strokeWidth={2.4} />
        <svg
          aria-hidden="true"
          viewBox="0 0 40 40"
          className="absolute inset-0 size-full animate-spin [animation-duration:1.6s]"
        >
          <circle
            cx="20"
            cy="20"
            r="16.5"
            fill="none"
            stroke="#17161b"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray="22 40"
          />
        </svg>
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-full bg-[radial-gradient(circle_at_32%_28%,#75727d_0%,#26252b_55%,#131217_100%)] ring-1 ring-black/5"
    >
      <Sprout className="mt-1 size-3.5 text-[#7fdc96]" strokeWidth={2.4} />
    </span>
  );
}

function ToolCard({
  tool,
  running,
}: {
  tool: ToolActivity;
  running: boolean;
}) {
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasDetail = Boolean(tool.detail);

  useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    },
    [],
  );

  const copy = async () => {
    if (!tool.detail) return;
    try {
      await navigator.clipboard.writeText(tool.detail);
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard can be unavailable (insecure context); keep the UI quiet.
    }
  };

  return (
    <div className="overflow-hidden rounded-[10px] border border-[#e6e2ee] bg-white/90 shadow-[0_2px_10px_rgba(20,18,30,0.05)]">
      <div className="flex h-9 items-center gap-2 px-3">
        <Terminal className="size-3.5 shrink-0 text-[#57545f]" strokeWidth={2} />
        <span className="truncate text-[12px] font-semibold text-[#232128]">
          {tool.name}
        </span>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {running ? (
            <ToolSpinner />
          ) : hasDetail ? (
            <CopyButton copied={copied} copy={copy} />
          ) : (
            <Check className="size-3.5 text-[#3f9b5f]" strokeWidth={2.2} />
          )}
          {hasDetail ? (
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              aria-expanded={open}
              aria-label={open ? "Collapse tool details" : "Expand tool details"}
              className="grid size-6 place-items-center rounded text-[#7c7984] transition hover:bg-black/5 hover:text-[#2b2930] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17161b]/20"
            >
              {open ? (
                <ChevronUp className="size-3.5" strokeWidth={2} />
              ) : (
                <ChevronDown className="size-3.5" strokeWidth={2} />
              )}
            </button>
          ) : null}
        </div>
      </div>

      {open && tool.detail ? (
        <div className="px-2 pb-2">
          {tool.demo ? (
            <DemoToolCode />
          ) : (
            <pre className="max-h-32 overflow-auto rounded-[6px] bg-[#0a0a0d] px-3 py-2.5 font-mono text-[10.5px] leading-[1.6] whitespace-pre-wrap break-words text-white/90">
              {tool.detail}
            </pre>
          )}
        </div>
      ) : null}
    </div>
  );
}

/** The seeded reference card, kept for /widget-preview. */
function DemoToolCode() {
  return (
    <div className="overflow-hidden rounded-[6px] bg-[#0a0a0d] px-3 py-2.5 font-mono text-[10.5px] leading-[1.6] text-white/90">
      <code className="block overflow-hidden whitespace-nowrap">
        <span className="text-white/40">{"{\""}</span>
        <span className="text-[#9be6a1]">code_str</span>
        <span className="text-white/40">{"\":\""}</span>
        <span className="text-[#f3f0f6]">import pandas as pd</span>
        <span className="text-[#9a93a8]">
          {"\\n# Load the workbook sheet\\n"}
        </span>
        <span className="text-[#f3f0f6]">df = pd.</span>
        <span className="text-[#b18cff]">read_excel</span>
        <span className="text-[#f3f0f6]">(</span>
        <span className="text-[#d9a6ff]">{"'sales.xlsx'"}</span>
        <span className="text-[#f3f0f6]">)</span>
        <span className="text-white/40">{"\"}"}</span>
      </code>
    </div>
  );
}

function ToolSpinner() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-3.5 animate-spin text-[#b5aee3] [animation-duration:1.3s]"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeDasharray="14 42"
      />
    </svg>
  );
}

function CopyButton({
  copied,
  copy,
}: {
  copied: boolean;
  copy: () => void;
}) {
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? "Copied code" : "Copy code"}
      className="grid size-6 place-items-center rounded text-[#7c7984] transition hover:bg-black/5 hover:text-[#2b2930] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17161b]/20"
    >
      {copied ? (
        <Check className="size-3.5" strokeWidth={2} />
      ) : (
        <Copy className="size-3.5" strokeWidth={2} />
      )}
    </button>
  );
}

/** Inert icon slot. Controls that are not wired yet stay out of the tab order
 *  instead of shipping dead buttons. */
function ComposerIcon({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <span
      aria-hidden="true"
      title={label}
      className="grid size-8 shrink-0 place-items-center rounded-full text-[#5f5c67]"
    >
      {children}
    </span>
  );
}
