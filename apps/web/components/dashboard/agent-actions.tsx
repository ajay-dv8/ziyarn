"use client";

import { useState } from "react";

import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@repo/ui/components/sheet";

import { Pencil } from "lucide-react";

type Agent = {
  id: string;
  name: string;
  description: string | null;
  filterQuestions: unknown;
};

export function AgentActions({
  agent,
  domainId,
}: {
  agent: Agent;
  domainId: string;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: agent.name,
    description: agent.description ?? "",
    filterQuestions:
      Array.isArray(agent.filterQuestions)
        ? agent.filterQuestions
            .filter((q): q is string => typeof q === "string")
            .join("\n")
        : "",
  });

  async function save() {
    if (!form.name.trim()) {
      setError("Give the agent a name.");
      return;
    }
    const filterQuestions = form.filterQuestions
      .split("\n")
      .map((questionLine) => questionLine.trim())
      .filter(Boolean);
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/agents/${agent.id}?domainId=${encodeURIComponent(domainId)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: form.name.trim(),
            description: form.description.trim() || undefined,
            filterQuestions:
              filterQuestions.length > 0 ? filterQuestions : [],
          }),
        },
      );
      const body = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      if (!response.ok) {
        setError(body?.error?.message ?? "We could not save the agent.");
        setSaving(false);
        return;
      }
      setOpen(false);
      window.location.reload();
    } catch {
      setError("Network error. Please try again.");
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button variant="outline" size="sm">
            <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
          </Button>
        }
      />
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Edit agent</SheetTitle>
          <SheetDescription>
            Filter questions are asked at the start of every conversation.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="edit-agent-name">Name</Label>
            <Input
              id="edit-agent-name"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-agent-description">About this business</Label>
            <Input
              id="edit-agent-description"
              value={form.description}
              onChange={(event) =>
                setForm({ ...form, description: event.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-agent-questions">Filter questions (one per line)</Label>
            <textarea
              id="edit-agent-questions"
              rows={8}
              placeholder={"How many employees do you have?\nWhat's your budget range?"}
              value={form.filterQuestions}
              onChange={(event) =>
                setForm({ ...form, filterQuestions: event.target.value })
              }
              className="w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30"
            />
          </div>
          {error ? (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <SheetFooter>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}