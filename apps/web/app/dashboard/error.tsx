"use client";

import { Button } from "@repo/ui/components/button";

export default function DashboardError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center gap-4 text-center">
      <div>
        <h2 className="text-lg font-semibold">This page could not be loaded</h2>
        <p className="text-sm text-muted-foreground">
          The network hiccuped. Try again — it usually works on retry.
        </p>
      </div>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}