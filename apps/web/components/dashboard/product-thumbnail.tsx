"use client";

import { useState } from "react";

import { Package } from "lucide-react";

export function ProductThumbnail({
  imageUrl,
  name,
  className = "size-10",
}: {
  imageUrl?: string | null;
  name: string;
  className?: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);

  if (!imageUrl || imageFailed) {
    return (
      <span
        aria-hidden="true"
        className={`${className} grid shrink-0 place-items-center rounded-md bg-muted`}
      >
        <Package className="size-4 text-muted-foreground" />
      </span>
    );
  }

  return (
    // Product images are owner-controlled remote URLs. Avoid Next Image because
    // catalog images can come from any connected commerce platform.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imageUrl}
      alt={name}
      className={`${className} shrink-0 rounded-md border border-border/60 object-cover`}
      onError={() => setImageFailed(true)}
    />
  );
}
