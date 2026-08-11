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

import {
  EmailTemplateEditor,
  type EmailTemplateDraft,
} from "@/components/dashboard/email-template-editor";

export function CreateCampaignButton() {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [draft, setDraft] = useState<EmailTemplateDraft | null>(null);

async function create() {
    if (draft?.kind === "blocks" && draft.blocks.length === 0) {
      setError("Add at least one block, or switch to HTML and paste a body.");
      return;
    }
    const payload =
      draft?.kind === "blocks"
        ? { name, subject, blocks: draft.blocks }
        : { name, subject, body: draft?.kind === "html" ? draft.body : "" };
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
      setDraft(null);
      window.location.reload();
    } catch {
      setError("Network error. Please try again.");
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button>New campaign</Button>} />
      <SheetContent side="right" className="w-full sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>New campaign</SheetTitle>
          <SheetDescription>
            Sent to every lead email your domains have captured (unsubscribed
            emails are skipped automatically).
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 py-4">
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
        <SheetFooter>
          <Button onClick={create} disabled={saving}>
            {saving ? "Creating…" : "Create campaign"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}