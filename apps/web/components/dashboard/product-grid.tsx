"use client";

import { useState } from "react";

import { formatMoney } from "@repo/money";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Checkbox } from "@repo/ui/components/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import {
  MoreHorizontal,
  Pencil,
  Pause,
  Play,
  Trash2,
  Loader2,
} from "lucide-react";

import { EditProductSheet, type EditableProduct } from "./edit-product-sheet";
import { cn } from "@repo/ui/lib/utils";

import type { Product } from "./products-list";

export function ProductGrid({
  products,
  onRefetch,
}: {
  products: Product[];
  onRefetch: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [editProduct, setEditProduct] = useState<EditableProduct | null>(null);

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function patchProduct(id: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/products/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.ok;
  }

  async function deleteProduct(id: string) {
    const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
    return res.ok;
  }

  async function handleToggleActive(id: string) {
    const product = products.find((p) => p.id === id);
    if (!product) return;
    setBusyId(id);
    const ok = await patchProduct(id, { active: !product.active });
    setBusyId(null);
    if (ok) onRefetch();
  }

  async function handleDelete(id: string) {
    setBusyId(id);
    const ok = await deleteProduct(id);
    setBusyId(null);
    if (ok) {
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      onRefetch();
    }
  }

  async function handleBulkAction(action: "activate" | "deactivate" | "delete") {
    setBulkBusy(true);
    const ids = Array.from(selected);
    if (action === "delete") {
      await Promise.all(ids.map(deleteProduct));
    } else {
      await Promise.all(
        ids.map((id) => {
          const product = products.find((p) => p.id === id);
          if (!product) return Promise.resolve();
          return patchProduct(id, { active: action === "activate" });
        }),
      );
    }
    setSelected(new Set());
    setBulkBusy(false);
    onRefetch();
  }

  return (
    <div className="space-y-4">
      {selected.size > 0 && (
        <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-4 py-2">
          <span className="text-sm text-muted-foreground">
            {selected.size} selected
          </span>
          <div className="ml-auto flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={bulkBusy}
              onClick={() => handleBulkAction("activate")}
            >
              {bulkBusy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Play className="mr-1 h-3.5 w-3.5" />}
              Activate
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={bulkBusy}
              onClick={() => handleBulkAction("deactivate")}
            >
              {bulkBusy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Pause className="mr-1 h-3.5 w-3.5" />}
              Deactivate
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={bulkBusy}
              onClick={() => handleBulkAction("delete")}
            >
              {bulkBusy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-1 h-3.5 w-3.5" />}
              Delete
            </Button>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {products.length === 0 ? (
          <p className="col-span-full py-12 text-center text-sm text-muted-foreground">
            No products found.
          </p>
        ) : (
          products.map((product) => (
            <Card key={product.id}>
              <CardHeader>
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={selected.has(product.id)}
                    onCheckedChange={() => toggleOne(product.id)}
                    aria-label={`Select ${product.name}`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base">{product.name}</CardTitle>
                      <Badge variant={product.active ? "secondary" : "outline"}>
                        {product.active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <CardDescription>
                      {product.description ?? "No description"}
                    </CardDescription>
                    {product.availability ? (
                      <p
                        className={cn(
                          "mt-1 text-xs",
                          product.availability === "Out of stock" ||
                            product.availability === "No longer in source"
                            ? "text-destructive"
                            : "text-muted-foreground",
                        )}
                      >
                        {product.availability}
                      </p>
                    ) : null}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-lg font-semibold">
                    {formatMoney({
                      amountMinor: product.priceCents,
                      currency: product.currency,
                    })}{" "}
                    <span className="text-sm font-normal text-muted-foreground uppercase">
                      {product.currency}
                    </span>
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={busyId === product.id}
                          aria-label={`Actions for ${product.name}`}
                        />
                      }
                    >
                      {busyId === product.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <MoreHorizontal className="h-4 w-4" />
                      )}
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setEditProduct(product)}>
                        <Pencil className="mr-2 h-4 w-4" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleToggleActive(product.id)}>
                        {product.active ? (
                          <><Pause className="mr-2 h-4 w-4" /> Deactivate</>
                        ) : (
                          <><Play className="mr-2 h-4 w-4" /> Activate</>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => handleDelete(product.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
      <EditProductSheet
        product={editProduct}
        open={editProduct !== null}
        onOpenChange={(open) => { if (!open) setEditProduct(null); }}
        onSaved={onRefetch}
      />
    </div>
  );
}
