"use client";

import { useState } from "react";

import { formatMoney } from "@repo/money";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Checkbox } from "@repo/ui/components/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@repo/ui/components/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";
import {
  LayoutGrid,
  Loader2,
  MoreHorizontal,
  Package,
  Pause,
  Play,
  Trash2,
} from "lucide-react";

type Product = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  currency: string;
  active: boolean;
};

const PAGE_SIZE = 10;

export function ProductTable({
  products,
  onRefetch,
}: {
  products: Product[];
  onRefetch: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(products.length / PAGE_SIZE));
  const paginated = products.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const allOnPageSelected =
    paginated.length > 0 && paginated.every((p) => selected.has(p.id));

  function toggleAll() {
    if (allOnPageSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        for (const p of paginated) next.delete(p.id);
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        for (const p of paginated) next.add(p.id);
        return next;
      });
    }
  }

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
          return patchProduct(id, {
            active: action === "activate",
          });
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

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={allOnPageSelected}
                  onCheckedChange={toggleAll}
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead className="w-12" />
              <TableHead>Product</TableHead>
              <TableHead className="hidden sm:table-cell">Description</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="hidden sm:table-cell">Status</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  No products found.
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(product.id)}
                      onCheckedChange={() => toggleOne(product.id)}
                      aria-label={`Select ${product.name}`}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted">
                      <Package className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">{product.name}</span>
                    <span className="block text-xs text-muted-foreground sm:hidden">
                      {product.description ?? "No description"}
                    </span>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <span className="text-sm text-muted-foreground line-clamp-1">
                      {product.description ?? "No description"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatMoney({
                      amountMinor: product.priceCents,
                      currency: product.currency,
                    })}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant={product.active ? "secondary" : "outline"}>
                      {product.active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
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
                        <DropdownMenuItem onClick={() => handleToggleActive(product.id)}>
                          {product.active ? (
                            <><Pause className="mr-2 h-4 w-4" /> Deactivate</>
                          ) : (
                            <><Play className="mr-2 h-4 w-4" /> Activate</>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem disabled>
                          Edit
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
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                aria-disabled={page === 1}
                className={page === 1 ? "pointer-events-none opacity-50" : ""}
              />
            </PaginationItem>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <PaginationItem key={p}>
                <PaginationLink isActive={p === page} onClick={() => setPage(p)}>
                  {p}
                </PaginationLink>
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                aria-disabled={page === totalPages}
                className={page === totalPages ? "pointer-events-none opacity-50" : ""}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}
