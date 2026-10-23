"use client";

import { useState } from "react";
import { Building2 } from "lucide-react";

import { cn } from "@repo/ui/lib/utils";

const CONTAINER_SIZES = {
  xs: "size-4 rounded",
  sm: "size-8 rounded-md",
  md: "size-10 rounded-lg",
  lg: "size-16 rounded-xl",
} as const;

const ICON_SIZES = {
  xs: "size-2.5",
  sm: "size-4",
  md: "size-5",
  lg: "size-7",
} as const;

export type DomainLogoSize = keyof typeof CONTAINER_SIZES;

/**
 * A domain's uploaded logo, or a neutral building icon when it has none.
 *
 * Kept as a client component so a stale or deleted image can fall back without
 * leaving a broken-image glyph in the dashboard. The URL is supplied by the
 * owner, so it may point anywhere; a plain <img> is used rather than next/image
 * because next/image would require every possible host in remotePatterns.
 */
export function DomainLogo({
  name,
  logoUrl,
  size = "md",
  className,
}: {
  name: string;
  logoUrl: string | null;
  size?: DomainLogoSize;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(logoUrl) && !failed;

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden border border-border/70",
        showImage ? "bg-white" : "bg-secondary",
        CONTAINER_SIZES[size],
        className,
      )}
    >
      {showImage && logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt={`${name} logo`}
          className="size-full object-contain"
          onError={() => setFailed(true)}
        />
      ) : (
        <Building2
          aria-hidden="true"
          className={cn("text-muted-foreground", ICON_SIZES[size])}
        />
      )}
    </span>
  );
}
