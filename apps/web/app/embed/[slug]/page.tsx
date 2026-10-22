import type { Metadata } from "next";

import { SleekEmbed } from "@/components/widget/sleek-embed";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Chat",
  robots: { index: false, follow: false },
};

/**
 * The iframe surface for Modern Sleek.
 *
 * The domain secret travels in the query string because the iframe is on a
 * customer's page; it is the same capability the script snippet exposes. The
 * chat itself validates it (and the plan) on /api/chat.
 */
export default async function EmbedPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ secret?: string | string[] }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const secret = typeof query.secret === "string" ? query.secret : "";

  return <SleekEmbed slug={slug} secret={secret} />;
}
