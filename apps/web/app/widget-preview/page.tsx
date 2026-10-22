import type { Metadata } from "next";

import { ChatWidget } from "@/components/widget/chat-widget";
import { WidgetBackdrop } from "@/components/widget/widget-backdrop";

export const metadata: Metadata = {
  title: "Chat widget preview",
  robots: { index: false, follow: false },
};

/**
 * Standalone stage for the Modern Sleek design.
 *
 * The blurred page behind the card is scenery, not part of the component, so
 * the card can be dropped into the dashboard or an iframe unchanged.
 */
export default function WidgetPreviewPage() {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#1b1a1f] px-4 py-8">
      <WidgetBackdrop />
      <ChatWidget className="relative z-10" />
    </main>
  );
}
