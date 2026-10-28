"use client";

import { useState } from "react";

import { formatDecimal } from "@repo/money";
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
} from "@repo/ui/components/sheet";

import { API_ROUTES } from "@/constants/routes";

export type EditableProduct = {
  id: string;
  name: string;
  description: string | null;
  imageUrl?: string | null;
  productUrl?: string | null;
  priceCents: number;
  currency: string;
  active: boolean;
};

export function EditProductSheet({
  product,
  open,
  onOpenChange,
  onSaved,
}: {
  product: EditableProduct | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(() => ({
    name: product?.name ?? "",
    description: product?.description ?? "",
    imageUrl: product?.imageUrl ?? "",
    productUrl: product?.productUrl ?? "",
    price: product
      ? formatDecimal({ amountMinor: product.priceCents, currency: product.currency })
      : "0",
    currency: product?.currency ?? "ghs",
  }));

  if (!product) return null;

  async function save() {
    const price = Number(form.price);
    if (!form.name.trim() || !Number.isFinite(price) || price < 0) {
      setError("Enter a valid name and price.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(API_ROUTES.products.byId(product!.id), {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim() || null,
          imageUrl: form.imageUrl.trim() || null,
          productUrl: form.productUrl.trim() || null,
          priceCents: Math.round(price * 100),
          currency: form.currency,
        }),
      });
      const body = (await res.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      if (!res.ok) {
        setError(body?.error?.message ?? "We could not update the product.");
        setSaving(false);
        return;
      }
      onOpenChange(false);
      onSaved();
    } catch {
      setError("Network error. Please try again.");
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
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
            <Label htmlFor="edit-product-image-url">Image URL</Label>
            <Input id="edit-product-image-url" type="url" placeholder="https://…" value={form.imageUrl} onChange={(event) => setForm({ ...form, imageUrl: event.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-product-page-url">Product page URL</Label>
            <Input
              id="edit-product-page-url"
              type="url"
              placeholder="https://your-site.com/products/…"
              value={form.productUrl}
              onChange={(event) =>
                setForm({ ...form, productUrl: event.target.value })
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
  );
}
