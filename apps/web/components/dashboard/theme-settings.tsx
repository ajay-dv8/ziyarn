"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

import { Check } from "lucide-react";

import { cn } from "@repo/ui/lib/utils";

type ThemeOption = {
  value: "light" | "dark" | "system";
  label: string;
};

const OPTIONS: ThemeOption[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

/** Miniature app-window mockups rendered in fixed palettes so each tile
 * always depicts its own theme regardless of the active one. */
function ThemePreview({ variant }: { variant: ThemeOption["value"] }) {
  const bar = "h-1.5 rounded-full";
  return (
    <div className="flex h-16 w-full gap-1 overflow-hidden rounded-md border p-1">
      {variant === "system" ? (
        <>
          <div className="relative flex-1 overflow-hidden rounded-sm bg-white">
            <div className="absolute inset-y-0 right-0 w-1/2 bg-[#0a0a0a]" />
            <div className="space-y-1 p-1">
              <div className={cn(bar, "w-3/4 bg-neutral-300")} />
              <div className={cn(bar, "w-1/2 bg-neutral-200")} />
            </div>
          </div>
        </>
      ) : (
        <div
          className={cn(
            "flex flex-1 gap-1 rounded-sm p-1",
            variant === "light" ? "bg-white" : "bg-[#0a0a0a]",
          )}
        >
          <div
            className={cn(
              "w-6 space-y-1 rounded-sm p-1",
              variant === "light" ? "bg-neutral-100" : "bg-neutral-900",
            )}
          >
            <div
              className={cn(
                bar,
                "w-full",
                variant === "light" ? "bg-neutral-300" : "bg-neutral-700",
              )}
            />
            <div
              className={cn(
                bar,
                "w-2/3",
                variant === "light" ? "bg-neutral-200" : "bg-neutral-800",
              )}
            />
          </div>
          <div className="flex-1 space-y-1 pt-0.5">
            <div
              className={cn(
                bar,
                "w-3/4",
                variant === "light" ? "bg-neutral-800" : "bg-neutral-300",
              )}
            />
            <div
              className={cn(
                bar,
                "w-full",
                variant === "light" ? "bg-neutral-200" : "bg-neutral-800",
              )}
            />
            <div
              className={cn(
                bar,
                "w-2/3",
                variant === "light" ? "bg-neutral-200" : "bg-neutral-800",
              )}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function ThemeSettings() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Render inert tiles before mount so server and client markup match.
  if (!mounted) {
    return (
      <div className="grid max-w-md grid-cols-3 gap-3">
        {OPTIONS.map((option) => (
          <div
            key={option.value}
            className="rounded-xl border border-transparent"
            aria-hidden
          >
            <ThemePreview variant={option.value} />
            <div className="mt-2 flex items-center justify-center gap-1.5">
              <span className="text-sm font-medium">{option.label}</span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="grid max-w-md grid-cols-3 gap-3"
    >
      {OPTIONS.map((option) => {
        const selected = theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => setTheme(option.value)}
            className={cn(
              "group rounded-xl outline-none transition-all focus-visible:ring-3 focus-visible:ring-ring/50",
              selected ? "border-transparent" : "border-transparent",
            )}
          >
            <div
              className={cn(
                "relative rounded-lg p-1 transition-all",
                selected ? "ring-2 ring-primary" : "ring-1 ring-border",
              )}
            >
              <ThemePreview variant={option.value} />
              {selected ? (
                <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
              ) : null}
            </div>
            <div className="mt-2 flex items-center justify-center gap-1.5">
              <span
                className={cn(
                  "text-sm",
                  selected ? "font-semibold" : "text-muted-foreground",
                )}
              >
                {option.label}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
