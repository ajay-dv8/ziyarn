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

const CURRENCIES = ["usd", "eur", "gbp"] as const;

export function CreateProductButton({
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
    price: "",
    currency: "usd" as (typeof CURRENCIES)[number],
  });

  async function create() {
    const price = Number(form.price);
    if (!form.name.trim() || !Number.isFinite(price) || price < 0) {
      setError("Enter a name and a valid price.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/products/new", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          domainId: form.domainId,
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          priceCents: Math.round(price * 100),
          currency: form.currency,
        }),
      });
      const body = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      if (!response.ok) {
        setError(body?.error?.message ?? "We could not create the product.");
        setSaving(false);
        return;
      }
      setOpen(false);
      setForm({
        domainId,
        name: "",
        description: "",
        price: "",
        currency: "usd",
      });
      window.location.reload();
    } catch {
      setError("Network error. Please try again.");
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button>New product</Button>} />
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>New product</SheetTitle>
          <SheetDescription>
            Add an item to your catalog. Agents can then sell it directly in
            chat and visitors pay via a secure portal link.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 py-4">
          {domains.length > 1 ? (
            <div className="space-y-2">
              <Label htmlFor="product-domain">Domain</Label>
              <select
                id="product-domain"
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
            <Label htmlFor="product-name">Name</Label>
            <Input
              id="product-name"
              placeholder="Premium setup, 1 hour"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="product-description">Description (optional)</Label>
            <Input
              id="product-description"
              placeholder="What the visitor gets"
              value={form.description}
              onChange={(event) =>
                setForm({ ...form, description: event.target.value })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="product-price">Price</Label>
            <div className="flex gap-2">
              <Input
                id="product-price"
                type="number"
                min="0"
                step="0.01"
                placeholder="49.00"
                value={form.price}
                onChange={(event) =>
                  setForm({ ...form, price: event.target.value })
                }
              />
              <select
                aria-label="Currency"
                value={form.currency}
                onChange={(event) =>
                  setForm({
                    ...form,
                    currency: event.target.value as (typeof CURRENCIES)[number],
                  })
                }
                className="w-24 rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm uppercase outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              >
                {CURRENCIES.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {error ? (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <SheetFooter>
          <Button onClick={create} disabled={saving}>
            {saving ? "Creating…" : "Create product"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}