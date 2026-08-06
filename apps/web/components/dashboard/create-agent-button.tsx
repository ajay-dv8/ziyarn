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

export function CreateAgentButton({
  domains,
  domainId,
}: {
  domains: { id: string; name: string }[];
  domainId: string;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    domainId,
    name: "",
    description: "",
    filterQuestions: "",
  });

  async function create() {
    if (!form.name.trim()) {
      setError("Give the agent a name.");
      return;
    }
    const filterQuestions = form.filterQuestions
      .split("\n")
      .map((q) => q.trim())
      .filter(Boolean);
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/agents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          domainId: form.domainId,
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          filterQuestions: filterQuestions.length > 0 ? filterQuestions : undefined,
        }),
      });
      const body = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      if (!response.ok) {
        setError(body?.error?.message ?? "We could not create the agent.");
        setSaving(false);
        return;
      }
      setOpen(false);
      setForm({ domainId, name: "", description: "", filterQuestions: "" });
      window.location.reload();
    } catch {
      setError("Network error. Please try again.");
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button>New agent</Button>} />
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>New agent</SheetTitle>
          <SheetDescription>
            Agents chat with your visitors. Filter questions are asked at the
            start of each conversation and saved with the lead.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 py-4">
          {domains.length > 1 ? (
            <div className="space-y-2">
              <Label htmlFor="agent-domain">Domain</Label>
              <select
                id="agent-domain"
                value={form.domainId}
                onChange={(event) =>
                  setForm({ ...form, domainId: event.target.value })
                }
                className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              >
                {domains.map((domain) => (
                  <option key={domain.id} value={domain.id}>
                    {domain.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="agent-name">Name</Label>
            <Input
              id="agent-name"
              placeholder="Sales assistant"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="agent-description">About this business</Label>
            <Input
              id="agent-description"
              placeholder="We help small teams automate their support"
              value={form.description}
              onChange={(event) =>
                setForm({ ...form, description: event.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="agent-questions">Filter questions (one per line)</Label>
            <textarea
              id="agent-questions"
              rows={5}
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
          <Button onClick={create} disabled={saving}>
            {saving ? "Creating…" : "Create agent"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}