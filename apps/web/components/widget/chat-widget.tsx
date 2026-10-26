"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { type ReactNode } from "react";
import {
  ArrowUp,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  Maximize2,
  Mic,
  Minimize2,
  Plus,
  Share2,
  Smile,
  Sprout,
  Terminal,
  User,
  X,
} from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/components/tooltip";
import { cn } from "@repo/ui/lib/utils";
import { formatMoney } from "@repo/money";
import { CHAT_ESCALATE_PATH } from "@repo/routes";
import {
  createSession,
  type AgentProduct,
  type HistoryResponse,
  type OwnerReply,
  type Session,
} from "@repo/widget-core";

import { WidgetMarkdown } from "@/components/widget/widget-markdown";

/**
 * Modern Sleek — the third widget surface.
 *
 * The chat itself runs on @repo/widget-core, the same session/transport used by
 * the Shadow DOM variants. This component is only the view: it is mounted by
 * the dashboard preview and by /embed/[slug], the page customers frame.
 *
 * `mode="demo"` renders the local-only preview used by /widget-preview, so the
 * design can still be reviewed without a domain secret.
 */

export type ChatWidgetMode = "demo" | "preview" | "embed";

type ToolActivity = {
  name: string;
  detail?: string;
  product?: AgentProduct | null;
};

type ChatMessage = {
  id: string;
  role: "assistant" | "user" | "owner";
  text: string;
  tool?: ToolActivity;
  products?: AgentProduct[];
  error?: string;
  errorCode?: string;
};

type Status = "loading" | "ready" | "error" | "unavailable";

const GREETING = "Hello! How can I help you today?";
const COMPOSER_MAX_HEIGHT_PX = 64;

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

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>(isDemo ? "ready" : "loading");
  const [statusMessage, setStatusMessage] = useState(
    "Connecting to the agent…",
  );
  const [placeholder, setPlaceholder] = useState("Ask anything...");
  const [agentName, setAgentName] = useState<string | null>(null);
  const [domainLogoUrl, setDomainLogoUrl] = useState<string | null>(null);
  const [escalated, setEscalated] = useState(false);
  const [products, setProducts] = useState<AgentProduct[]>([]);
  const [viewerProduct, setViewerProduct] = useState<AgentProduct | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const sessionRef = useRef<Session | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
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
        setDomainLogoUrl(config.domain?.logoUrl ?? null);
        const configuredPlaceholder = config.placeholders?.find((value) =>
          value.trim(),
        );
        if (configuredPlaceholder) setPlaceholder(configuredPlaceholder);
        setProducts(config.products ?? []);

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

  const resizeComposer = useCallback((element: HTMLTextAreaElement | null) => {
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, COMPOSER_MAX_HEIGHT_PX)}px`;
    element.style.maxHeight = `${COMPOSER_MAX_HEIGHT_PX}px`;
    element.style.overflow = "hidden";
  }, []);

  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages]);

  useEffect(() => {
    resizeComposer(textareaRef.current);
  }, [draft, resizeComposer]);

  useEffect(() => {
    if (mode === "embed" && status === "ready") textareaRef.current?.focus();
  }, [mode, status]);

  useEffect(() => {
    // Escape is layered: it closes the product viewer first and only closes
    // the whole chat when no viewer is open (embed mode has both).
    if (!onClose && !viewerProduct) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (viewerProduct) {
        setViewerProduct(null);
        return;
      }
      onClose?.();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, viewerProduct]);

  const openProduct = useCallback((product: AgentProduct) => {
    setViewerProduct(product);
  }, []);

  const closeProduct = useCallback(() => {
    setViewerProduct(null);
  }, []);

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
      onTool: (name, args) => {
        const product =
          name === "sell_product"
            ? findProductByName(String(args?.product ?? ""), products)
            : null;
        patchMessage(replyId, (message) => {
          if (product) {
            return {
              ...message,
              products: [...(message.products ?? []), product],
            };
          }
          return {
            ...message,
            tool: {
              name: toolLabel(name),
              detail: toolDetail(args),
              product: null,
            },
          };
        });
      },
      onEscalate: () => setEscalated(true),
      onDone: () => {},
      onError: (errorMessage, errorCode) =>
        patchMessage(replyId, (message) => ({
          ...message,
          error: errorMessage,
          errorCode,
        })),
    });

    setStreaming(false);
    setActiveId(null);
    patchMessage(replyId, (message) => {
      if (
        message.text.trim() ||
        message.tool ||
        message.products?.length ||
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

  const escalateToHuman = useCallback(
    async (reason?: string) => {
      const session = sessionRef.current;
      const conversationId = session?.conversationId;
      if (conversationId) {
        try {
          await fetch(`${apiBase}${CHAT_ESCALATE_PATH}`, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              ...(secret ? { "x-embed-secret": secret } : {}),
            },
            body: JSON.stringify({ conversationId, reason }),
          });
        } catch {
          // The visitor-facing handoff still moves on; the notification itself
          // is best effort.
        }
      }
      setEscalated(true);
      setStatusMessage("Connecting you with a human...");
      session?.listenForOwnerReplies({ onMessage: appendOwnerMessage });
    },
    [apiBase, appendOwnerMessage, secret],
  );

  const composerWidth = isPreview
    ? "w-full max-w-[410px]"
    : "w-[min(88vw,410px)]";

  return (
    <div className={cn("relative flex w-full flex-col items-center", className)}>
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
              ? "h-105 w-full max-w-130"
              : "h-[min(68dvh,450px)] w-[min(92vw,520px)]",
        )}
      >
        {/* Soft lavender bloom behind the conversation, like the reference. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-[34%] -left-24 size-80 rounded-full bg-transparent blur-[72px]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 bottom-6 size-44 rounded-full bg-transparent blur-[60px]"
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

        {!isPreview ? (
          <TooltipProvider delay={300}>
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    onClick={() => setExpanded((value) => !value)}
                    aria-label={expanded ? "Exit Full Screen" : "Full Screen"}
                    className="absolute top-3 left-3 z-20 grid size-8 place-items-center rounded-full bg-white/75 text-[#494652] shadow-[0_6px_18px_-6px_rgba(23,22,27,0.3)] backdrop-blur transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17161b]/20"
                  >
                    {expanded ? (
                      <Minimize2 className="size-4" strokeWidth={2} />
                    ) : (
                      <Maximize2 className="size-4" strokeWidth={2} />
                    )}
                  </button>
                }
              />
              <TooltipContent side="right">
                {expanded ? "Exit Full Screen" : "Full Screen"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : null}

        {status === "ready" ? (
          <div
            ref={scrollRef}
            className={cn(
              "relative flex-1 overflow-y-auto overscroll-contain px-5 sm:px-6 no-scrollbar [&::-webkit-scrollbar]:hidden",
              isPreview ? "pt-5 sm:pt-6" : "pt-14",
              onClose && "pr-12 sm:pr-14",
              isPreview ? "pb-5" : "pb-16",
            )}
          >
            <div
              role="log"
              aria-live="polite"
              aria-label="Conversation"
              className="space-y-4.5"
            >
              {messages.map((message) =>
                message.role === "user" ? (
                  <UserMessage key={message.id} text={message.text} />
                ) : (
                  <AssistantMessage
                    key={message.id}
                    message={message}
                    running={message.id === activeId}
                    logoUrl={domainLogoUrl}
                    onOpenProduct={openProduct}
                    onEscalate={escalateToHuman}
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
            {status === "loading" ? (
              <AssistantAvatar running logoUrl={domainLogoUrl} />
            ) : null}
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

        <textarea
          ref={textareaRef}
          rows={1}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            resizeComposer(event.target);
          }}
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
          className="min-w-0 max-h-16 flex-1 resize-none overflow-hidden bg-transparent px-1.5 py-1 text-[12.5px] text-[#1b1a20] outline-none placeholder:text-[#8f8b97]"
        />

        <ComposerIcon label="Voice input">
          <Mic className="size-4" strokeWidth={2} />
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
              className="block size-2.5 rounded-xs bg-white"
            />
          ) : (
            <ArrowUp className="size-4" strokeWidth={2.2} />
          )}
        </button>
      </div>

      {viewerProduct ? (
        <ProductView
          product={viewerProduct}
          mode={mode}
          onClose={closeProduct}
        />
      ) : null}
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

function findProductByName(
  productName: string,
  catalog: AgentProduct[],
): AgentProduct | null {
  const normalized = productName.trim().toLowerCase();
  if (!normalized) return null;
  return (
    catalog.find(
      (candidate) => candidate.name.trim().toLowerCase() === normalized,
    ) ?? null
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
  logoUrl,
  onOpenProduct,
  onEscalate,
}: {
  message: ChatMessage;
  running: boolean;
  logoUrl?: string | null;
  onOpenProduct: (product: AgentProduct) => void;
  onEscalate?: (reason?: string) => void;
}) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-start gap-3">
        <AssistantAvatar running={running} logoUrl={logoUrl} />
        <div className="min-w-0 pt-0.5">
          {message.text ? (
            message.role === "assistant" ? (
              <WidgetMarkdown text={message.text} />
            ) : (
              <p className="text-[13px] leading-[1.55] whitespace-pre-line text-[#1a1920]">
                {message.text}
              </p>
            )
          ) : running ? (
            <p className="text-[13px] leading-[1.55] text-[#8f8b97] italic">
              Working…
            </p>
          ) : null}
          {/* A card already answers the turn: a provider error (429, timeout)
              must not sit above it. Errors only show when nothing else
              rendered, and the API has already made the text customer-safe. */}
          {message.error && !message.products?.length ? (
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <p className="text-[11px] leading-[1.45] text-[#b3261e]">
                {message.error}
              </p>
              {message.errorCode === "AI_MODEL_UNAVAILABLE" ? (
                <button
                  type="button"
                  onClick={() => onEscalate?.("model_unavailable")}
                  className="rounded-full bg-[#17161b] px-2.5 py-1 text-[11px] font-medium text-white transition hover:bg-[#2a2930] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17161b]/20"
                >
                  Escalate to human agent
                </button>
              ) : null}
            </div>
          ) : null}
          {message.role === "owner" ? (
            <p className="mt-1 text-[9.5px] font-medium tracking-wide text-[#9c99a5]">
              Team
            </p>
          ) : null}
        </div>
      </div>
      {message.products?.length ? (
        <div
          className={cn(
            "ml-11 flex gap-2.5 overflow-x-auto pb-1",
            "snap-x snap-mandatory scrollbar-none [&::-webkit-scrollbar]:hidden",
            "focus-within:outline-none",
          )}
        >
          {message.products.map((product, index) => (
            <ProductCard
              key={`${product.name}-${index}`}
              product={product}
              onOpen={onOpenProduct}
            />
          ))}
        </div>
      ) : message.tool ? (
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
        <User className="size-3.75" strokeWidth={2} />
      </span>
    </div>
  );
}

function AssistantAvatar({
  running,
  logoUrl,
}: {
  running: boolean;
  logoUrl?: string | null;
}) {
  const [failedLogoUrl, setFailedLogoUrl] = useState<string | null>(null);
  const showLogo = Boolean(logoUrl) && failedLogoUrl !== logoUrl;

  if (showLogo && logoUrl) {
    return (
      <span className="relative grid size-8 shrink-0 place-items-center overflow-hidden rounded-full bg-white ring-1 ring-black/10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoUrl}
          alt=""
          className="size-full object-contain"
          onError={() => setFailedLogoUrl(logoUrl)}
        />
        {running ? (
          <svg
            aria-hidden="true"
            viewBox="0 0 40 40"
            className="absolute inset-0 size-full animate-spin animation-duration-[1.6s]"
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
        ) : null}
      </span>
    );
  }

  if (running) {
    return (
      <span className="relative grid size-8 shrink-0 place-items-center rounded-full bg-[#3fcf6e] text-[#0c5a2d] ring-1 ring-black/5">
        <Smile className="size-4" strokeWidth={2.4} />
        <svg
          aria-hidden="true"
          viewBox="0 0 40 40"
          className="absolute inset-0 size-full animate-spin animation-duration-[1.6s]"
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

/**
 * A vertical commerce card: big image on top, name and price below. Tapping
 * anywhere on the card opens the fullscreen viewer; the share control floats
 * above the image as a sibling button (never nested inside the tap target).
 */
function ProductCard({
  product,
  onOpen,
}: {
  product: AgentProduct;
  onOpen: (product: AgentProduct) => void;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(product.imageUrl) && !imageFailed;

  return (
    <article
      className={cn(
        "group relative w-[min(55vw,13rem)] shrink-0 snap-start snap-always",
        "overflow-hidden rounded-[14px] border border-[#e6e2ee] bg-white",
        "shadow-[0_2px_10px_rgba(20,18,30,0.06)]",
        "transition-[transform,box-shadow] duration-200 ease-out",
        "hover:-translate-y-0.5 hover:shadow-[0_14px_34px_-16px_rgba(20,18,30,0.34)]",
        "motion-reduce:transition-none motion-reduce:hover:translate-y-0",
      )}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-[#f6f4f9]">
        {showImage && product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt={product.name}
            loading="lazy"
            className="size-full object-cover"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <span
            aria-hidden="true"
            className="grid size-full place-items-center bg-[radial-gradient(circle_at_32%_28%,#75727d_0%,#26252b_55%,#131217_100%)] text-[42px] font-semibold text-white"
          >
            {product.name.trim().charAt(0).toUpperCase()}
          </span>
        )}
      </div>

      <div className="px-3 pb-3 pt-2.5">
        <p className="truncate text-[12.5px] font-semibold text-[#232128]">
          {product.name}
        </p>
        <p className="text-[12px] font-medium text-[#494652]">
          {formatMoney({
            amountMinor: product.priceCents,
            currency: product.currency,
          })}
        </p>
      </div>

      {/*
       * The tap target is a real button stretched over the whole card; the
       * share control is its sibling (z-20), so the two never nest.
       */}
      <button
        type="button"
        onClick={() => onOpen(product)}
        aria-label={`View ${product.name}`}
        className="absolute inset-0 z-10 cursor-pointer focus-visible:[outline:2px_solid_rgba(23,22,27,0.3)] focus-visible:[outline-offset:-3px]"
      />
      <ShareButton product={product} className="absolute top-2.5 right-2.5 z-20" />
    </article>
  );
}

/**
 * The fullscreen product viewer. In embed mode the iframe already owns the
 * whole screen, so `fixed inset-0` is the full-screen customer sees; in the
 * dashboard preview and widget-preview the same markup is kept
 * `absolute inset-0` so it stays framed inside the preview surface instead of
 * hijacking the owner's browser tab.
 */
function ProductView({
  product,
  mode,
  onClose,
}: {
  product: AgentProduct;
  mode: ChatWidgetMode;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(product.imageUrl) && !imageFailed;

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={product.name}
      className={cn(
        mode === "embed" ? "fixed inset-0 z-50" : "absolute inset-0 z-40",
        "flex flex-col overflow-hidden",
        "bg-[radial-gradient(120%_110%_at_50%_0%,#efe5ff_0%,#f7f4fb_50%,#f3f1f6_100%)]",
        "motion-safe:animate-zy-view-in",
      )}
    >
      <button
        ref={closeRef}
        type="button"
        onClick={onClose}
        aria-label="Close product view"
        className="absolute top-3 right-3 z-30 grid size-8 place-items-center rounded-full bg-white/75 text-[#494652] shadow-[0_6px_18px_-6px_rgba(23,22,27,0.3)] backdrop-blur transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17161b]/20"
      >
        <X className="size-4" strokeWidth={2} />
      </button>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
        {/* The hero grows to fill leftover space so a short description never
            floats above a void; the photo stays contained so the visitor sees
            the whole product, not a crop of it. */}
        <div className="flex min-h-[min(44dvh,380px)] w-full flex-1 items-center justify-center border-b border-[#e6e2ee]/70 bg-white">
          {showImage && product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.imageUrl}
              alt={product.name}
              className="max-h-full max-w-full object-contain p-4"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <span
              aria-hidden="true"
              className="grid size-full place-items-center bg-[radial-gradient(circle_at_32%_28%,#75727d_0%,#26252b_55%,#131217_100%)] text-[56px] font-semibold text-white"
            >
              {product.name.trim().charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        <div className="px-5 pt-4 pb-2">
          <h2 className="text-[16px] leading-[1.3] font-semibold text-[#1a1920]">
            {product.name}
          </h2>
          <p className="mt-1 text-[14px] font-semibold text-[#232128]">
            {formatMoney({
              amountMinor: product.priceCents,
              currency: product.currency,
            })}
          </p>
          {product.description?.trim() ? (
            <p className="mt-3 text-[12.5px] leading-[1.6] whitespace-pre-line text-[#494652]">
              {product.description.trim()}
            </p>
          ) : null}
        </div>

        {/* Pinned over long text while scrolling; sits right beneath the
            content when the screen fits it. */}
        <div className="sticky bottom-0 bg-gradient-to-t from-[#f3f1f6] via-[#f3f1f6]/95 to-transparent px-5 pt-4 pb-4">
          <div className="flex items-center gap-2">
            <ShareButton product={product} variant="primary" className="flex-1" />
            {product.imageUrl ? <DownloadButton product={product} /> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Share with feedback: the icon flips to a short check after the share sheet
 * completes. A silently-stale check would claim more than these steps do, so
 * only a verified send/copy triggers it.
 */
function ShareButton({
  product,
  variant = "pill",
  className,
}: {
  product: AgentProduct;
  /** `pill` is the icon-only launcher on the card; `primary` sits in the bar. */
  variant?: "pill" | "primary";
  className?: string;
}) {
  const [done, setDone] = useState(false);
  const doneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (doneTimer.current) clearTimeout(doneTimer.current);
    },
    [],
  );

  const share = async () => {
    try {
      const result = await shareProduct(product);
      setDone(true);
      if (doneTimer.current) clearTimeout(doneTimer.current);
      doneTimer.current = setTimeout(() => setDone(false), 1600);
      // A visitor sharing without a link yet gets a copied fallback on
      // desktop; the check still means "something left your hands".
      void result;
    } catch {
      // AbortError = the visitor closed the sheet; clipboard may also be
      // unavailable. Either way the UI stays quiet.
    }
  };

  const label = done ? "Shared" : "Share";

  if (variant === "pill") {
    return (
      <button
        type="button"
        onClick={() => void share()}
        aria-label={done ? "Shared" : `Share ${product.name}`}
        title={done ? "Shared" : "Share"}
        className={cn(
          "grid size-8 place-items-center rounded-full border border-white/70 bg-white/85 text-[#494652]",
          "shadow-[0_6px_18px_-6px_rgba(23,22,27,0.3)] backdrop-blur transition hover:bg-white",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17161b]/20",
          className,
        )}
      >
        {done ? (
          <Check className="size-3.5 text-[#3f9b5f]" strokeWidth={2.2} />
        ) : (
          <Share2 className="size-3.5" strokeWidth={2} />
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void share()}
      className={cn(
        "flex items-center justify-center gap-1.5 rounded-full bg-[#0d0c11] px-4 py-2.5",
        "text-[12.5px] font-semibold text-white",
        "shadow-[0_10px_24px_-10px_rgba(13,12,17,0.55)] transition hover:bg-black",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17161b]/30",
        className,
      )}
    >
      {done ? (
        <Check className="size-3.5" strokeWidth={2.4} />
      ) : (
        <Share2 className="size-3.5" strokeWidth={2.2} />
      )}
      {label}
    </button>
  );
}

function DownloadButton({ product }: { product: AgentProduct }) {
  const [done, setDone] = useState(false);
  const doneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (doneTimer.current) clearTimeout(doneTimer.current);
    },
    [],
  );

  const download = async () => {
    await downloadProductImage(product);
    setDone(true);
    if (doneTimer.current) clearTimeout(doneTimer.current);
    doneTimer.current = setTimeout(() => setDone(false), 1600);
  };

  return (
    <button
      type="button"
      onClick={() => void download()}
      aria-label={done ? "Image saved" : "Download product image"}
      title="Download image"
      className={cn(
        "flex items-center justify-center gap-1.5 rounded-full border border-[#e6e2ee] bg-white px-4 py-2.5",
        "text-[12.5px] font-semibold text-[#232128]",
        "shadow-[0_4px_10px_rgba(20,18,30,0.06)] transition hover:bg-[#faf8fc]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17161b]/20",
      )}
    >
      {done ? (
        <Check className="size-3.5 text-[#3f9b5f]" strokeWidth={2.4} />
      ) : (
        <Download className="size-3.5" strokeWidth={2.2} />
      )}
      {done ? "Saved" : "Image"}
    </button>
  );
}

/**
 * Shares a product through the native sheet — with the photo attached where
 * the device supports file sharing — and falls back to the clipboard on
 * browsers without the Share API (Firefox desktop, and insecure contexts).
 * A sheet canceled by the visitor rejects with AbortError; callers stay quiet.
 */
async function shareProduct(
  product: AgentProduct,
): Promise<"shared" | "copied"> {
  const extensions = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean;
  };
  const text = `${product.name} — ${formatMoney({
    amountMinor: product.priceCents,
    currency: product.currency,
  })}`;

  if (typeof navigator.share === "function") {
    if (product.imageUrl) {
      try {
        const file = await imageFileFromUrl(product.imageUrl, product.name);
        if (file && extensions.canShare?.({ files: [file] })) {
          await navigator.share({
            files: [file],
            text,
            title: product.name,
          });
          return "shared";
        }
      } catch (error) {
        // The visitor closed the sheet — that is a finished action, not a
        // failure to retry through a different path.
        if (error instanceof DOMException && error.name === "AbortError") {
          throw error;
        }
        // Anything else (fetch refused, share failed) falls through to the
        // plain-text share below.
      }
    }

    await navigator.share({ text, title: product.name });
    return "shared";
  }

  const details = product.description?.trim()
    ? `${text}\n\n${product.description.trim()}`
    : text;
  await navigator.clipboard.writeText(details);
  return "copied";
}

/**
 * Saves the product photo to the visitor's device. Convex storage answers the
 * widget origin with CORS, so the image usually arrives as a real blob and
 * downloads cleanly; when it cannot, the raw URL opens in a new tab so the
 * visitor keeps a path to the image at all.
 */
async function downloadProductImage(product: AgentProduct): Promise<boolean> {
  if (!product.imageUrl) return false;

  try {
    const response = await fetch(product.imageUrl, {
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${slugifyFilename(product.name)}.${imageFileExtension(
      blob.type,
    )}`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 4_000);
    return true;
  } catch {
    // Cross-origin failures, offline devices, blocked downloads — keep a
    // useful last resort rather than a dead button.
    window.open(product.imageUrl, "_blank", "noopener,noreferrer");
    return false;
  }
}

async function imageFileFromUrl(
  url: string,
  productName: string,
): Promise<File | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) return null;

    const blob = await response.blob();
    if (!blob.type.startsWith("image/")) return null;
    return new File(
      [blob],
      `${slugifyFilename(productName)}.${imageFileExtension(blob.type)}`,
      { type: blob.type },
    );
  } catch {
    return null;
  }
}

function imageFileExtension(mimeType: string): string {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/gif") return "gif";
  return "jpg";
}

function slugifyFilename(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "ziyarn-product";
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
          <pre className="max-h-32 overflow-auto rounded-[6px] bg-[#0a0a0d] px-3 py-2.5 font-mono text-[10.5px] leading-[1.6] whitespace-pre-wrap break-words text-white/90">
            {tool.detail}
          </pre>
        </div>
      ) : null}
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
