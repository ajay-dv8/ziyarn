import type { ReactNode } from "react";

import { source } from "@/lib/source";
import { DocsLayout as FumadocsLayout } from "fumadocs-ui/layouts/docs";
import { Providers } from "./providers";
import "./docs.css";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <Providers>
      <FumadocsLayout tree={source.getPageTree()} nav={{ title: "Ziyarn Docs" }}>
        {children}
      </FumadocsLayout>
    </Providers>
  );
}
