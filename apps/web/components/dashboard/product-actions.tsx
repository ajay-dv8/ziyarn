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

import { Pencil, Play, Pause } from "lucide-react";

type Product = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  currency: string;
  active: boolean;
};

export function ProductActions({
  product,
}: {
  product: Product;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: product.name,
    description: product.description ?? "",
    price: (product.priceCents / 100).toFixed(2),
    currency: product.currency,
  });

  async function edit(payload: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/products/${product.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      if (!response.ok) {
        setError(body?.error?.message ?? "We could not update the product.");
        setSaving(false);
        return false;
      }
      return true;
    } catch {
      setError("Network error. Please try again.");
      setSaving(false);
      return false;
    }
  }

  async function save() {
    const price = Number(form.price);
    if (!form.name.trim() || !Number.isFinite(price) || price < 0) {
      setError("Enter a valid name and price.");
      return;
    }
    const ok = await edit({
      name: form.name.trim(),
      description: form.description.trim() || null,
      priceCents: Math.round(price * 100),
      currency: form.currency,
    });
    if (ok) {
      setOpen(false);
      window.location.reload();
    }
  }

  async function toggleActive() {
    const ok = await edit({ active: !product.active });
    if (ok) window.location.reload();
  }

  return (
    <div className="flex items-center gap-2">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger render={<Button variant="outline" size="icon" aria-label={`Edit ${product.name}`}><Pencil className="h-4 w-4" /></Button>} />
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Edit product</SheetTitle>
            <SheetDescription>
              Keep name and price in sync with what visitors will be charged.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-product-name">Name</Label>
              <Input
                id="edit-product-name"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-product-description">Description</Label>
              <Input
                id="edit-product-description"
                value={form.description}
                onChange={(event) =>
                  setForm({ ...form, description: event.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-product-price">Price</Label>
              <div className="flex gap-2">
                <Input
                  id="edit-product-price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={(event) =>
                    setForm({ ...form, price: event.target.value })
                  }
                />
                <span className="flex items-center rounded-lg border px-3 text-sm text-muted-foreground uppercase">
                  {form.currency}
                </span>
              </div>
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
      <Button
        variant={product.active ? "ghost" : "default"}
        size="sm"
        onClick={toggleActive}
        disabled={saving}
      >
        {product.active ? (
          <><Pause className="mr-1 h-3.5 w-3.5" /> Deactivate</>
        ) : (
          <><Play className="mr-1 h-3.5 w-3.5" /> Activate</>
        )}
      </Button>
    </div>
  );
}