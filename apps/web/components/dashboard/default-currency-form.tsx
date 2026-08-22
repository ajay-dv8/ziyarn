"use client";

import { useState } from "react";

import { CURRENCY_CODES, type CurrencyCode } from "@repo/money";
import { Button } from "@repo/ui/components/button";
import { Label } from "@repo/ui/components/label";

export function DefaultCurrencyForm({
  defaultCurrency,
}: {
  defaultCurrency: string;
}) {
  const [currency, setCurrency] = useState(defaultCurrency);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function save() {
    if (currency === defaultCurrency) {
      setSuccess(false);
      setError(null);
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ defaultCurrency: currency }),
      });
      const body = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      if (!response.ok) {
        setError(body?.error?.message ?? "We could not save your preference.");
        setSaving(false);
        return;
      }
      setSuccess(true);
      setSaving(false);
    } catch {
      setError("Network error. Please try again.");
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="default-currency">Default currency</Label>
        <div className="flex items-center gap-2">
          <select
            id="default-currency"
            value={currency}
            onChange={(event) => setCurrency(event.target.value)}
            className="w-32 rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          >
            {CURRENCY_CODES.map((code) => (
              <option key={code} value={code}>
                {code.toUpperCase()}
              </option>
            ))}
          </select>
          <Button onClick={save} disabled={saving} variant="secondary">
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="text-sm text-muted-foreground">Preference saved.</p>
      )}
    </div>
  );
}
