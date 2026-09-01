"use client";

import type { ReactNode } from "react";
import { RootProvider } from "fumadocs-ui/provider/next";

export function Providers({ children }: { children: ReactNode }) {
  return <RootProvider>{children}</RootProvider>;
}
