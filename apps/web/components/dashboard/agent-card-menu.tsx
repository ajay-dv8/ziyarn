"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import type { AgentTools } from "@repo/api/agents/schemas";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Checkbox } from "@repo/ui/components/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@repo/ui/components/sheet";

import {
  Bot,
  BookOpen,
  Cpu,
  Flag,
  MoreVertical,
  Pencil,
  Settings2,
  Sparkles,
  Trash2,
  Volume2,
} from "lucide-react";

import { APP_ROUTES, API_ROUTES } from "@/constants/routes";

type AgentCardAgent = {
  id: string;
  name: string;
  description: string | null;
  instructions: string | null;
  systemPrompt: string | null;
  tools: string[] | null;
  filterQuestions: unknown;
};

type ToolOption = {
  id: AgentTools;
  label: string;
  description: string;
};

const TOOL_OPTIONS: ToolOption[] = [
  {
    id: "capture_email",
    label: "Capture email and lead details",
    description: "Collect contact details and save the visitor's filter answers.",
  },
  {
    id: "book_appointment",
    label: "Book appointments",
    description: "Offer available slots and schedule a meeting.",
  },
  {
    id: "create_payment",
    label: "Create payment requests",
    description: "Send a payment link for a custom amount.",
  },
  {
    id: "sell_product",
    label: "Sell products",
    description: "Recommend and sell items from the domain's product catalog.",
  },
  {
    id: "escalate",
    label: "Escalate to a human",
    description: "Hand the conversation to your team when a visitor asks.",
  },
  {
    id: "answer_knowledge",
    label: "Answer from knowledge",
    description: "Search uploaded documents and crawled pages.",
  },
];

const textareaClassName =
  "w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30";

function initialTools(tools: string[] | null): AgentTools[] {
  return (tools ?? []).filter((tool): tool is AgentTools =>
    TOOL_OPTIONS.some((option) => option.id === tool),
  );
}

function questionsToText(questions: unknown): string {
  if (!Array.isArray(questions)) {
    return "";
  }
  return questions
    .filter((question): question is string => typeof question === "string")
    .join("\n");
}

async function readErrorMessage(
  response: Response,
  fallback: string,
): Promise<string> {
  const body = (await response.json().catch(() => null)) as {
    error?: { message?: string };
  } | null;
  return body?.error?.message ?? fallback;
}

export function AgentCardMenu({
  agent,
  domainId,
  isDefault,
  agentCount,
}: {
  agent: AgentCardAgent;
  domainId: string;
  isDefault: boolean;
  agentCount: number;
}) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [configureOpen, setConfigureOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [configureSaving, setConfigureSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [configureError, setConfigureError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    name: agent.name,
    description: agent.description ?? "",
  });
  const [configureForm, setConfigureForm] = useState({
    instructions: agent.instructions ?? "",
    systemPrompt: agent.systemPrompt ?? "",
    tools: initialTools(agent.tools),
    filterQuestions: questionsToText(agent.filterQuestions),
  });

  function toggleTool(toolId: AgentTools) {
    setConfigureForm((current) => ({
      ...current,
      tools: current.tools.includes(toolId)
        ? current.tools.filter((existingTool) => existingTool !== toolId)
        : [...current.tools, toolId],
    }));
  }

  async function saveEdit() {
    if (!editForm.name.trim()) {
      setEditError("Give the agent a name.");
      return;
    }

    setEditSaving(true);
    setEditError(null);
    try {
      const response = await fetch(
        `${API_ROUTES.agents.byId(agent.id)}?domainId=${encodeURIComponent(domainId)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: editForm.name.trim(),
            description: editForm.description.trim(),
          }),
        },
      );
      if (!response.ok) {
        setEditError(
          await readErrorMessage(response, "We could not save the agent."),
        );
        setEditSaving(false);
        return;
      }

      setEditOpen(false);
      setEditSaving(false);
      router.refresh();
    } catch {
      setEditError("Network error. Please try again.");
      setEditSaving(false);
    }
  }

  async function saveConfiguration() {
    const filterQuestions = configureForm.filterQuestions
      .split("\n")
      .map((questionLine) => questionLine.trim())
      .filter(Boolean);

    if (filterQuestions.length > 20) {
      setConfigureError("Keep filter questions to 20 or fewer.");
      return;
    }
    if (filterQuestions.some((question) => question.length > 300)) {
      setConfigureError("Each filter question must be 300 characters or fewer.");
      return;
    }

    setConfigureSaving(true);
    setConfigureError(null);
    try {
      const response = await fetch(
        `${API_ROUTES.agents.byId(agent.id)}?domainId=${encodeURIComponent(domainId)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            instructions: configureForm.instructions.trim(),
            systemPrompt: configureForm.systemPrompt.trim(),
            tools: configureForm.tools,
            filterQuestions,
          }),
        },
      );
      if (!response.ok) {
        setConfigureError(
          await readErrorMessage(response, "We could not save the agent."),
        );
        setConfigureSaving(false);
        return;
      }

      setConfigureOpen(false);
      setConfigureSaving(false);
      router.refresh();
    } catch {
      setConfigureError("Network error. Please try again.");
      setConfigureSaving(false);
    }
  }

  async function deleteAgent() {
    setDeleting(true);
    setDeleteError(null);
    try {
      const response = await fetch(
        `${API_ROUTES.agents.byId(agent.id)}?domainId=${encodeURIComponent(domainId)}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        setDeleteError(
          await readErrorMessage(response, "We could not delete the agent."),
        );
        setDeleting(false);
        return;
      }

      setDeleteOpen(false);
      setDeleting(false);
      router.refresh();
    } catch {
      setDeleteError("Network error. Please try again.");
      setDeleting(false);
    }
  }

  const comingSoonSettings = [
    {
      icon: Bot,
      title: "Default widget agent",
      description: isDefault
        ? "This agent is used by the widget today. Choosing a different default is coming soon."
        : "The widget currently uses the oldest agent. Choosing a different default is coming soon.",
    },
    {
      icon: Cpu,
      title: "Model and provider",
      description:
        "Choose a model or provider for this agent. Agents currently inherit the domain AI settings.",
    },
    {
      icon: Volume2,
      title: "Voice",
      description:
        "Voice replies, language, and read-aloud for the widget.",
    },
    {
      icon: Sparkles,
      title: "Creativity",
      description: "Adjust response temperature and creativity.",
    },
    {
      icon: Flag,
      title: "Advanced escalation rules",
      description:
        "Dedicated escalation policies and notifications. Use custom instructions for now.",
    },
  ];

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="-mt-1 shrink-0 border-border text-foreground hover:bg-accent hover:text-foreground/80"
              aria-label={`Actions for ${agent.name}`}
            />
          }
        >
          <MoreVertical className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem
            onClick={() => {
              setEditError(null);
              setEditOpen(true);
            }}
          >
            <Pencil className="size-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              setConfigureError(null);
              setConfigureOpen(true);
            }}
          >
            <Settings2 className="size-4" />
            Configure
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => {
              setDeleteError(null);
              setDeleteOpen(true);
            }}
          >
            <Trash2 className="size-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* ---- Edit: identity only ---- */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit agent</DialogTitle>
            <DialogDescription>
              Change the name and description shown on this card.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`agent-name-${agent.id}`}>Name</Label>
              <Input
                id={`agent-name-${agent.id}`}
                maxLength={100}
                value={editForm.name}
                onChange={(event) =>
                  setEditForm({ ...editForm, name: event.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`agent-description-${agent.id}`}>
                About this business
              </Label>
              <textarea
                id={`agent-description-${agent.id}`}
                rows={4}
                maxLength={500}
                className={textareaClassName}
                value={editForm.description}
                onChange={(event) =>
                  setEditForm({
                    ...editForm,
                    description: event.target.value,
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                Added to the agent&apos;s prompt as context about the business.
              </p>
            </div>
            {editError ? (
              <p className="text-sm text-destructive" role="alert">
                {editError}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <DialogClose
              render={<Button variant="outline" disabled={editSaving} />}
            >
              Cancel
            </DialogClose>
            <Button onClick={saveEdit} disabled={editSaving}>
              {editSaving ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Configure: prompt, tools, questions, knowledge ---- */}
      <Sheet open={configureOpen} onOpenChange={setConfigureOpen}>
        <SheetContent
          side="right"
          className="data-[side=right]:w-full data-[side=right]:sm:max-w-xl"
        >
          <SheetHeader>
            <SheetTitle>Configure {agent.name}</SheetTitle>
            <SheetDescription>
              Shape how the agent answers and which actions it can take.
            </SheetDescription>
          </SheetHeader>

          <div className="min-h-0 flex-1 space-y-7 overflow-y-auto px-4 pb-4">
            <section className="space-y-3">
              <div>
                <h3 className="text-sm font-medium">Prompt</h3>
                <p className="text-xs text-muted-foreground">
                  Instructions are added to the agent&apos;s prompt. The system
                  prompt replaces the default prompt for this business type.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor={`agent-instructions-${agent.id}`}>
                  Custom instructions
                </Label>
                <textarea
                  id={`agent-instructions-${agent.id}`}
                  rows={5}
                  maxLength={4000}
                  className={textareaClassName}
                  placeholder={
                    "Always mention our 30-day return policy.\nNever quote a price that is not in the catalog."
                  }
                  value={configureForm.instructions}
                  onChange={(event) =>
                    setConfigureForm({
                      ...configureForm,
                      instructions: event.target.value,
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Best for tone, policies, and topics the agent should avoid.
                </p>
              </div>
              <details className="rounded-lg border p-3">
                <summary className="cursor-pointer text-sm font-medium">
                  Advanced: system prompt
                </summary>
                <div className="space-y-2 pt-3">
                  <Label htmlFor={`agent-system-prompt-${agent.id}`}>
                    System prompt override
                  </Label>
                  <textarea
                    id={`agent-system-prompt-${agent.id}`}
                    rows={8}
                    maxLength={16000}
                    className={textareaClassName}
                    placeholder="Leave blank to use the default prompt for this business type."
                    value={configureForm.systemPrompt}
                    onChange={(event) =>
                      setConfigureForm({
                        ...configureForm,
                        systemPrompt: event.target.value,
                      })
                    }
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">
                      Leave blank to use the default prompt for this business
                      type.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      disabled={!configureForm.systemPrompt}
                      onClick={() =>
                        setConfigureForm({
                          ...configureForm,
                          systemPrompt: "",
                        })
                      }
                    >
                      Use default
                    </Button>
                  </div>
                </div>
              </details>
            </section>

            <section className="space-y-3">
              <div>
                <h3 className="text-sm font-medium">Capabilities</h3>
                <p className="text-xs text-muted-foreground">
                  Choose what the agent can do during a conversation.
                </p>
              </div>
              <div className="space-y-2">
                {TOOL_OPTIONS.map((tool) => (
                  <label
                    key={tool.id}
                    htmlFor={`agent-tool-${agent.id}-${tool.id}`}
                    className="flex cursor-pointer items-start gap-3 rounded-lg border p-3"
                  >
                    <Checkbox
                      id={`agent-tool-${agent.id}-${tool.id}`}
                      checked={configureForm.tools.includes(tool.id)}
                      onCheckedChange={() => toggleTool(tool.id)}
                      aria-label={tool.label}
                      className="mt-0.5"
                    />
                    <span className="min-w-0 space-y-0.5">
                      <span className="block text-sm font-medium">
                        {tool.label}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {tool.description}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
              {configureForm.filterQuestions.trim().length > 0 &&
              !configureForm.tools.includes("capture_email") ? (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Filter answers are saved with capture email. Enable it or the
                  answers will not be stored.
                </p>
              ) : null}
              {!configureForm.tools.includes("escalate") ? (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Visitors cannot be handed to a human while escalation is off.
                </p>
              ) : null}
            </section>

            <section className="space-y-2">
              <div>
                <h3 className="text-sm font-medium">Filter questions</h3>
                <p className="text-xs text-muted-foreground">
                  Asked one at a time before the agent captures an email or
                  sells a product.
                </p>
              </div>
              <Label htmlFor={`agent-questions-${agent.id}`}>
                Questions (one per line)
              </Label>
              <textarea
                id={`agent-questions-${agent.id}`}
                rows={5}
                className={textareaClassName}
                placeholder={
                  "How many employees do you have?\nWhat's your budget range?"
                }
                value={configureForm.filterQuestions}
                onChange={(event) =>
                  setConfigureForm({
                    ...configureForm,
                    filterQuestions: event.target.value,
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                Up to 20 questions, 300 characters each.
              </p>
            </section>

            <section className="space-y-2">
              <div>
                <h3 className="text-sm font-medium">Knowledge</h3>
                <p className="text-xs text-muted-foreground">
                  Uploaded documents and crawled pages this agent can search.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                render={
                  <Link
                    href={`${APP_ROUTES.DASHBOARD_KNOWLEDGE}?domainId=${encodeURIComponent(domainId)}&agentId=${encodeURIComponent(agent.id)}`}
                  />
                }
              >
                <BookOpen className="size-4" />
                Manage knowledge
              </Button>
            </section>

            <section className="space-y-3 rounded-lg border border-dashed p-4">
              <div>
                <h3 className="text-sm font-medium">More agent settings</h3>
                <p className="text-xs text-muted-foreground">
                  These are planned but not available yet.
                </p>
              </div>
              <div className="space-y-3">
                {comingSoonSettings.map((setting) => {
                  const SettingIcon = setting.icon;
                  return (
                    <div key={setting.title} className="flex items-start gap-3">
                      <SettingIcon
                        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium">{setting.title}</p>
                          <Badge variant="outline">Coming soon</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {setting.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {configureError ? (
              <p className="text-sm text-destructive" role="alert">
                {configureError}
              </p>
            ) : null}
          </div>

          <SheetFooter className="flex-row justify-end">
            <SheetClose
              render={<Button variant="outline" disabled={configureSaving} />}
            >
              Cancel
            </SheetClose>
            <Button onClick={saveConfiguration} disabled={configureSaving}>
              {configureSaving ? "Saving…" : "Save changes"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ---- Delete: irreversible ---- */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete {agent.name}?</DialogTitle>
            <DialogDescription>
              This permanently deletes this agent along with its conversations
              and messages, knowledge documents, crawl jobs, and database
              connections. Products, customers, leads, bookings, and payments
              stay with the domain. This cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {agentCount <= 1 ? (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
              This is the only agent for this domain. The widget will stop
              answering visitors until you create another one.
            </p>
          ) : isDefault ? (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
              This agent is currently used by the widget. The next oldest agent
              will take over after deletion.
            </p>
          ) : null}

          {deleteError ? (
            <p className="text-sm text-destructive" role="alert">
              {deleteError}
            </p>
          ) : null}

          <DialogFooter>
            <DialogClose
              render={<Button variant="outline" disabled={deleting} />}
            >
              Cancel
            </DialogClose>
            <Button
              variant="destructive"
              onClick={deleteAgent}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Delete agent"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
