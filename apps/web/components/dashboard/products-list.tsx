"use client";

import { useState } from "react";

import { Button } from "@repo/ui/components/button";
import { LayoutGrid, TableIcon } from "lucide-react";

import { ProductTable } from "./product-table";
import { ProductGrid } from "./product-grid";

export type Product = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  currency: string;
  active: boolean;
  availability?: string | null;
};

export function ProductsList({
  products,
}: {
  products: Product[];
}) {
  const [view, setView] = useState<"table" | "grid">("table");

  function refetch() {
    window.location.reload();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <div className="flex rounded-lg border">
          <Button
            variant={view === "table" ? "secondary" : "ghost"}
            size="icon"
            className="h-8 w-8 rounded-r-none"
            onClick={() => setView("table")}
            aria-label="Table view"
          >
            <TableIcon className="h-4 w-4" />
          </Button>
          <Button
            variant={view === "grid" ? "secondary" : "ghost"}
            size="icon"
            className="h-8 w-8 rounded-l-none"
            onClick={() => setView("grid")}
            aria-label="Grid view"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {view === "table" ? (
        <ProductTable products={products} onRefetch={refetch} />
      ) : (
        <ProductGrid products={products} onRefetch={refetch} />
      )}
    </div>
  );
}
