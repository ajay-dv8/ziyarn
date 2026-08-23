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
import { Label } from "@repo/ui/components/label";
import { Loader2, Upload } from "lucide-react";

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/g;

function parseRows(text: string): Array<{ name?: string; email: string }> {
  const rows: Array<{ name?: string; email: string }> = [];
  const seen = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    // CSV with header support: find the email cell, treat another cell as name.
    const cells = line.split(/[,;\t]/).map((c) => c.trim().replace(/^"|"$/g, ""));
    let email = "";
    let name = "";
    for (const cell of cells) {
      if (!cell) continue;
      const match = cell.match(EMAIL_RE);
      if (match && !email) {
        email = match[0].toLowerCase();
        continue;
      }
      // Skip header-ish words.
      if (!name && !/^(name|email|full ?name)$/i.test(cell)) {
        name = cell;
      }
    }
    if (email && !seen.has(email)) {
      seen.add(email);
      rows.push({ email, name: name || undefined });
    }
  }
  return rows;
}

export function ImportCustomersDialog({ domainId }: { domainId: string }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = parseRows(text);
  const canImport = parsed.length > 0 && !importing;

  async function importList() {
    setImporting(true);
    setError(null);
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ domainId, rows: parsed }),
      });
      const body = (await res.json().catch(() => null)) as {
        imported?: number;
        error?: { message?: string };
      } | null;
      if (!res.ok) {
        setError(body?.error?.message ?? "Import failed.");
        return;
      }
      window.location.reload();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline"><Upload className="mr-1.5 h-4 w-4" /> Import list</Button>} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import subscribers</DialogTitle>
          <DialogDescription>
            Paste rows or upload a CSV export — one contact per line. We detect
            the email automatically and keep any other column as the name.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="customer-file">CSV or text file</Label>
            <input
              id="customer-file"
              type="file"
              accept=".csv,.txt,text/csv,text/plain"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                setFileName(file.name);
                setText(await file.text());
                setError(null);
              }}
              className="w-full cursor-pointer rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-2.5 file:py-1 file:text-xs file:font-medium file:text-primary"
            />
            {fileName ? (
              <p className="text-xs text-muted-foreground">{fileName}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="customer-paste">…or paste here</Label>
            <textarea
              id="customer-paste"
              rows={6}
              placeholder={"jane@acme.com, Jane Mensah\nkojo@shop.gh"}
              value={text}
              onChange={(event) => setText(event.target.value)}
              className="w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 font-mono text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            />
            <p className="text-xs text-muted-foreground">
              {parsed.length} contact{parsed.length === 1 ? "" : "s"} detected
            </p>
          </div>
          {error ? (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button onClick={importList} disabled={!canImport}>
            {importing ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" /> Importing…
              </>
            ) : (
              `Import ${parsed.length || ""}`.trim()
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
