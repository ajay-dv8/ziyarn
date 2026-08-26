"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@repo/ui/components/button";
import { Card, CardContent } from "@repo/ui/components/card";
import { ShineBorder } from "@repo/ui/components/shine-border";
import { Paperclip } from "lucide-react";

import { createDomainAction } from "@/lib/actions/domains";
import { APP_ROUTES } from "@/constants/routes";

import {
  ChatMessage,
  ChatTyping,
  type ChatRole,
} from "./chat-message";
import { ChatInput } from "./chat-input";
import { ChatChoices, type ChatChoiceOption } from "./chat-choices";

type Step =
  | "intro"
  | "domainName"
  | "domainSlug"
  | "logoUrl"
  | "agentName"
  | "agentDescription"
  | "creating"
  | "knowledgeChoice"
  | "knowledgeUploading"
  | "finishing";

type Message = {
  id: string;
  role: ChatRole;
  content: string;
  emphasis?: boolean;
  subText?: string[];
};

function slugify(value: string): string {
  const base = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base.length >= 3 ? base : `${base || "workspace"}-app`;
}

const isUrl = (value: string) => /^https?:\/\/\S+\.\S+/i.test(value);

export function ConversationalOnboarding({
  userName,
}: {
  userName: string;
}) {
  const router = useRouter();

  const [step, setStep] = useState<Step>("intro");
  const [messages, setMessages] = useState<Message[]>([]);
  const [typing, setTyping] = useState(false);
  const [choices, setChoices] = useState<ChatChoiceOption[] | null>(null);
  const [busy, setBusy] = useState(false);

  const [domainName, setDomainName] = useState("");
  const [slugSuggestion, setSlugSuggestion] = useState("");
  const [agentId, setAgentId] = useState<string | null>(null);
  const [domainId, setDomainId] = useState<string | null>(null);
  const [pendingDescription, setPendingDescription] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const firstName = userName.split(" ")[0] ?? "there";

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    });
  }, []);

  useEffect(scrollToBottom, [messages, typing, choices, scrollToBottom]);

  const addMessage = useCallback(
    (role: ChatRole, content: string, extra?: Partial<Message>) => {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role, content, ...extra },
      ]);
    },
    [],
  );

  /** Shows the typing indicator briefly before revealing a bot message. */
  const botSay = useCallback(
    async (
      content: string,
      extra?: Partial<Message>,
      delay = 450,
    ): Promise<void> => {
      setTyping(true);
      await new Promise((resolve) => setTimeout(resolve, delay));
      setTyping(false);
      addMessage("bot", content, extra);
    },
    [addMessage],
  );

  const showChoices = useCallback((options: ChatChoiceOption[]) => {
    setChoices(options);
  }, []);

  // Kick off the conversation once — guard against StrictMode's double
  // effect invocation in development duplicating the greeting. The cleanup
  // resets the guard so the remounted effect can run a fresh sequence.
  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    let cancelled = false;
    void (async () => {
      await botSay(
        `Welcome to Ziyarn, ${firstName}! 👋 Let's get your first workspace set up.`,
        undefined,
        250,
      );
      if (cancelled) return;
      await botSay("What should we name your domain?", {
        emphasis: true,
        subText: [
          "Your domain is your helpdesk home — it gets its own AI agent",
          "and chat widget. Pick a name that identifies your business.",
          "For example: Acme Support",
        ],
      });
      if (!cancelled) setStep("domainName");
    })();
    return () => {
      cancelled = true;
      startedRef.current = false;
      setTyping(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ------------------------------ step handlers ----------------------- */

  async function handleDomainName(value: string) {
    addMessage("user", value);
    setDomainName(value);
    setSlugSuggestion(slugify(value));
    await botSay(`"${value}" — love it.`, undefined, 300);
    await botSay("Pick a URL slug for your widget links.", {
      emphasis: true,
      subText: [
        `Press Enter to use "${slugify(value)}", or type your own.`,
        "Lowercase letters, numbers and hyphens only.",
      ],
    });
    setStep("domainSlug");
  }

  async function handleDomainSlug(value: string) {
    const slug = value ? slugify(value) : slugSuggestion;
    void slug;
    addMessage("user", value || slugSuggestion);
    await botSay("Got it.", undefined, 250);
    await botSay("Do you have a logo? Attach one, paste an image URL, or skip.", {
      subText: ["It appears on your chat widget. Press Enter to skip."],
    });
    setStep("logoUrl");
  }

  async function promptAgent() {
    await botSay("Perfect. Now let's bring in your AI agent.", undefined, 300);
    await botSay("What should we call your agent?", {
      emphasis: true,
      subText: ["For example: Sales Assistant"],
    });
    setStep("agentName");
  }

  async function handleLogoUrl(value: string) {
    if (value && !isUrl(value)) {
      addMessage("user", value);
      await botSay(
        "Hmm, that doesn't look like a URL. Paste a link starting with http(s):// — or press Enter to skip.",
      );
      return;
    }
    if (value) addMessage("user", value);
    else addMessage("user", "Skip logo");
    pendingLogoRef.current = value || null;
    await promptAgent();
  }

  async function handleLogoFile(file: File) {
    const okType = [
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/svg+xml",
    ].includes(file.type);
    if (!okType || file.size > 2 * 1024 * 1024) {
      await botSay(
        "That file isn't usable — logos must be PNG, JPG, WebP or SVG under 2 MB. Try another or press Enter to skip.",
      );
      return;
    }

    addMessage("user", `📎 ${file.name}`);
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/uploads/logo", {
        method: "POST",
        body: form,
      });
      const body = (await res.json().catch(() => null)) as {
        url?: string;
        error?: { message?: string };
      } | null;
      if (!res.ok || !body?.url) {
        throw new Error(body?.error?.message ?? "Upload failed");
      }
      pendingLogoRef.current = body.url;
      setBusy(false);
      await botSay("Logo saved ✓");
      await promptAgent();
    } catch (error) {
      setBusy(false);
      await botSay(
        `The upload didn't make it: ${
          error instanceof Error ? error.message : "unknown error"
        }. You can try again or continue without a logo.`,
      );
      showChoices([
        {
          label: "Try again",
          onSelect: () => {
            setChoices(null);
            logoInputRef.current?.click();
          },
        },
        {
          label: "Continue without a logo",
          variant: "outline",
          onSelect: () => {
            setChoices(null);
            addMessage("user", "Skip logo");
            void promptAgent();
          },
        },
      ]);
    }
  }

  const pendingLogoRef = useRef<string | null>(null);

  async function handleAgentName(value: string) {
    addMessage("user", value);
    await botSay(`${value} it is.`, undefined, 250);
    await botSay("In a sentence — what does your business do?", {
      subText: ["This helps the agent answer questions accurately. Press Enter to skip."],
    });
    setStep("agentDescription");
  }

  async function handleAgentDescription(value: string) {
    if (value) addMessage("user", value);
    else addMessage("user", "Skip description");
    setPendingDescription(value);
    await botSay("Amazing. Setting up your domain and agent now…", undefined, 350);
    void runCreation();
  }

  async function runCreation() {
    setBusy(true);
    setStep("creating");

    const slugAttempt = (n: number) => {
      const base = slugify(domainName);
      return n === 0 ? base : `${base}-${n + 1}`;
    };

    let createdDomainId: string | null = null;
    let lastError: string | null = null;
    for (let attempt = 0; attempt < 5 && !createdDomainId; attempt += 1) {
      const result = await createDomainAction({
        name: domainName,
        slug: slugAttempt(attempt),
        logoUrl: pendingLogoRef.current,
      });
      if (result.ok && result.domainId) {
        createdDomainId = result.domainId;
      } else {
        lastError = result.ok
          ? "unexpected empty result"
          : result.error;
      }
    }

    if (!createdDomainId) {
      setBusy(false);
      await botSay(`I couldn't create the domain: ${lastError ?? "unknown error"}`);
      showChoices([
        {
          label: "Try again",
          onSelect: () => {
            setChoices(null);
            void runCreation();
          },
        },
        {
          label: "Skip setup for now",
          variant: "outline",
          onSelect: () => void finish(),
        },
      ]);
      return;
    }

    setDomainId(createdDomainId);

    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          domainId: createdDomainId,
          name: "Assistant",
          description: pendingDescription || undefined,
        }),
      });
      const body = (await res.json().catch(() => null)) as {
        agent?: { id: string };
        error?: { message?: string };
      } | null;
      if (!res.ok || !body?.agent?.id) {
        throw new Error(body?.error?.message ?? "Agent creation failed");
      }
      setAgentId(body.agent.id);
    } catch (error) {
      setBusy(false);
      await botSay(
        `Your domain is ready, but the agent didn't make it: ${
          error instanceof Error ? error.message : "unknown error"
        }. You can add one later under Agents.`,
      );
      showChoices([
        { label: "Continue anyway", onSelect: () => void askKnowledge() },
      ]);
      return;
    }

    setBusy(false);
    await botSay("🎉 Your domain and AI agent are live!", undefined, 350);
    void askKnowledge();
  }

  async function askKnowledge() {
    setChoices(null);
    await botSay("Last thing — want to train your agent right now?", undefined, 400);
    await botSay("Add documents to its knowledge base?", {
      emphasis: true,
      subText: ["PDF, TXT, Markdown, HTML, DOCX or XLSX — you can always add more later."],
    });
    setStep("knowledgeChoice");
    showChoices([
      {
        label: "Upload a file",
        onSelect: () => {
          setChoices(null);
          addMessage("user", "Upload a file");
          fileInputRef.current?.click();
        },
      },
      {
        label: "Skip for now",
        variant: "outline",
        onSelect: () => {
          setChoices(null);
          addMessage("user", "Skip for now");
          void finish();
        },
      },
    ]);
  }

  async function handleKnowledgeFile(file: File) {
    setBusy(true);
    setStep("knowledgeUploading");
    await botSay(`Reading ${file.name}…`, undefined, 200);
    try {
      const form = new FormData();
      form.append("domainId", domainId ?? "");
      form.append("agentId", agentId ?? "");
      form.append("file", file);
      const res = await fetch("/api/knowledge/upload", {
        method: "POST",
        body: form,
      });
      const body = (await res.json().catch(() => null)) as {
        chunkCount?: number;
        error?: { message?: string };
      } | null;
      if (!res.ok) {
        throw new Error(body?.error?.message ?? "Upload failed");
      }
      await botSay(
        `Done — stored as ${body?.chunkCount ?? 0} searchable chunks. Your agent can answer from it now.`,
      );
    } catch (error) {
      await botSay(
        `That didn't work: ${
          error instanceof Error ? error.message : "upload failed"
        }. No worries — you can add files anytime from the Knowledge page.`,
      );
    } finally {
      setBusy(false);
      void finish();
    }
  }

  async function finish() {
    setChoices(null);
    setBusy(true);
    setStep("finishing");
    await botSay("You're all set! Taking you to your dashboard… 🚀", undefined, 500);
    router.push(APP_ROUTES.DASHBOARD);
    router.refresh();
  }

  /* ------------------------------- render ------------------------------ */

  const inputDisabled =
    busy ||
    typing ||
    step === "creating" ||
    step === "knowledgeChoice" ||
    step === "knowledgeUploading" ||
    step === "finishing";

  return (
    <Card className="relative flex h-[80svh] w-full max-w-lg flex-col overflow-hidden md:max-w-4xl">
      <ShineBorder
        borderWidth={1.5}
        duration={10}
        shineColor={["#10b981", "#06b6d4", "#8b5cf6"]}
      />
      <CardContent className="flex min-h-0 flex-1 flex-col gap-4 pt-6">
        <div
          ref={scrollRef}
          className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1"
        >
          {messages.map((message) => (
            <ChatMessage
              key={message.id}
              role={message.role}
              subText={message.subText}
            >
              {message.emphasis ? (
                <strong className="italic">{message.content}</strong>
              ) : (
                message.content
              )}
            </ChatMessage>
          ))}
          {typing ? <ChatTyping /> : null}
        </div>

        <div className="shrink-0 space-y-3 border-t pt-4">
          {choices ? (
            <>
              <ChatChoices options={choices} />
              {/* Keep focusable input out of the way while choosing */}
              <div className="h-0 overflow-hidden opacity-0" aria-hidden>
                <ChatInput onSubmit={() => {}} disabled />
              </div>
            </>
          ) : step === "knowledgeChoice" ? null : step === "finishing" ? (
            <Button className="w-full" disabled>
              Redirecting…
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              {step === "logoUrl" ? (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  disabled={inputDisabled}
                  aria-label="Attach a logo from your device"
                  title="Attach a logo from your device"
                  onClick={() => logoInputRef.current?.click()}
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
              ) : null}
              <div className="min-w-0 flex-1">
                <ChatInput
                  disabled={inputDisabled}
                  allowEmpty={
                    step === "domainSlug" ||
                    step === "logoUrl" ||
                    step === "agentDescription"
                  }
                  placeholder={
                    step === "domainName"
                      ? "e.g. Acme Support"
                      : step === "domainSlug"
                        ? slugSuggestion
                          ? `${slugSuggestion} (press Enter to accept)`
                          : "your-domain"
                        : step === "logoUrl"
                          ? "Paste an image URL, or press Enter to skip"
                          : step === "agentName"
                            ? "e.g. Sales Assistant"
                            : "Type your answer… (Enter to skip)"
                  }
                  onSubmit={(value) => {
                    void (async () => {
                  if (step === "intro") return;
                  if (step === "domainName") await handleDomainName(value);
                  else if (step === "domainSlug") await handleDomainSlug(value);
                  else if (step === "logoUrl") await handleLogoUrl(value);
                  else if (step === "agentName") await handleAgentName(value);
                  else if (step === "agentDescription")
                    await handleAgentDescription(value);
                })();
              }}
                />
              </div>
            </div>
          )}

          <input
            ref={logoInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void handleLogoFile(file);
            }}
          />

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt,.md,.html,.htm,.doc,.docx,.xls,.xlsx"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void handleKnowledgeFile(file);
              else void askKnowledge();
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
