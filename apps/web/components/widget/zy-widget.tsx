"use client";

import { createElement, useEffect } from "react";

export type ZyWidgetProps = {
  slug: string;
  secret: string;
  title?: string;
  subtitle?: string;
  color?: string;
  position?: "bottom-right" | "bottom-left";
  api?: string;
};

/** Loads /widget.js once, then renders the <zy-widget> custom element. */
export function ZyWidget({
  slug,
  secret,
  title,
  subtitle,
  color,
  position,
  api,
}: ZyWidgetProps) {
  useEffect(() => {
    if (document.querySelector('script[data-zy-widget="true"]')) return;
    const script = document.createElement("script");
    script.src = "/widget.js";
    script.defer = true;
    script.setAttribute("data-zy-widget", "true");
    document.head.appendChild(script);
  }, []);

  return createElement("zy-widget", {
    "data-slug": slug,
    "data-secret": secret,
    "data-title": title,
    "data-subtitle": subtitle,
    "data-color": color,
    "data-position": position,
    "data-api": api,
  });
}
