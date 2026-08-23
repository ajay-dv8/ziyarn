"use client";

import { useState } from "react";

import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui/components/dialog";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";

import {
  EmailTemplateEditor,
  type EmailTemplateDraft,
} from "@/components/dashboard/email-template-editor";

type Audience = "all" | "chat" | "database" | "site";

const AUDIENCES: Array<{ value: Audience; label: string; hint: string }> = [
  {
    value: "all",
    label: "All customers",
    hint: "Everyone on your customer list",
  },
  {
    value: "chat",
    label: "From chat",
    hint: "Emails your agent captured in conversations",
  },
  {
    value: "database",
    label: "From database",
    hint: "Contacts synced from your connected database",
  },
  {
    value: "site",
    label: "Subscribers",
    hint: "Subscribers you imported to the customers page",
  },
];

export function CreateCampaignButton() {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [audience, setAudience] = useState<Audience>("all");
  const [draft, setDraft] = useState<EmailTemplateDraft | null>(null);

  async function create() {
    const payload = { name, subject, body: draft?.body ?? "", audience };
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      if (!response.ok) {
        setError(body?.error?.message ?? "We could not create the campaign.");
        setSaving(false);
        return;
      }
      setOpen(false);
      setName("");
      setSubject("");
      setAudience("all");
      setDraft(null);
      window.location.reload();
    } catch {
      setError("Network error. Please try again.");
      setSaving(false);
    }
  }

  const audienceHint =
    AUDIENCES.find((a) => a.value === audience)?.hint ?? "";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>New campaign</Button>} />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>New campaign</DialogTitle>
          <DialogDescription>
            Pick an audience from your customers, write the email, and send.
            Unsubscribed emails are always skipped.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="campaign-name">Name</Label>
              <Input
                id="campaign-name"
                placeholder="May product update"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="campaign-audience">Audience</Label>
              <select
                id="campaign-audience"
                value={audience}
                onChange={(event) => setAudience(event.target.value as Audience)}
                className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {AUDIENCES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">{audienceHint}</p>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="campaign-subject">Subject</Label>
            <Input
              id="campaign-subject"
              placeholder="What's new in May"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Body</Label>
            <EmailTemplateEditor onDraft={setDraft} />
          </div>
          {error ? (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button onClick={create} disabled={saving}>
            {saving ? "Creating…" : "Create campaign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
