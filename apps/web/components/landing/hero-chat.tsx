"use client";

import { ArrowUp, Mic, Plus, Sprout, User } from "lucide-react";

import { formatMoney } from "@repo/money";

import { WidgetMarkdown } from "@/components/widget/widget-markdown";
import { cn } from "@repo/ui/lib/utils";

/**
 * WHAT SHOWS ON THE HERO — edit this array.
 *
 * Each turn is one message: role "user" or "assistant", its text, and the
 * product cards the reply presents. Delete, reorder or add turns freely —
 * the hero renders exactly this script, top to bottom. Assistant text supports
 * the widget's small markdown subset (bold, links, lists).
 *
 * Product cards show a monogram placeholder until you drop a photo in:
 *   1. Add the image under apps/web/public (or any URL).
 *   2. Set imageUrl on the product ("public/products/dress.jpg").
 *
 * This copy is intentionally the ONLY content here: the chat is a static
 * demonstration, so nothing can break the hero panel by live streaming.
 */
export type HeroChatProduct = {
  name: string;
  /** Minor unit of the currency: pesewas for GHS, cents for USD. */
  priceCents: number;
  /** ISO 4217 code, e.g. "GHS". */
  currency: string;
  /** TODO: product photos — the card renders a monogram until this is set. */
  imageUrl?: string;
  description?: string;
};

export type HeroChatTurn = {
  role: "user" | "assistant";
  text: string;
  /** Product cards the assistant's reply presents under its text. */
  products?: HeroChatProduct[];
};

export const HERO_CHAT_SCRIPT: HeroChatTurn[] = [
  {
    role: "user",
    text: "Hi! I'm shopping for the weekend in Kumasi. What's trending?",
  },
  {
    role: "assistant",
    text: "Great timing — these three are flying off the shelves this month:",
    products: [
      {
        name: "Ankara Wrap Dress",
        priceCents: 18_000,
        currency: "GHS",
        // imageUrl: "/products/ankara-wrap-dress.jpg",
      },
      {
        name: "Kente Headwrap",
        priceCents: 6_500,
        currency: "GHS",
        // imageUrl: "/products/kente-headwrap.jpg",
      },
      {
        name: "Adinkra Tote",
        priceCents: 12_000,
        currency: "GHS",
        // imageUrl: "/products/adinkra-tote.jpg",
      },
    ],
  },
  {
    role: "user",
    text: "The wrap dress — do you deliver to Old Tafo by Saturday?",
  },
  {
    role: "assistant",
    text: "Yes — Greater Kumasi arrives in 1–2 business days, and delivery is free over GH₵500.",
  },
  { role: "user", text: "Can I book a fitting at the shop Saturday morning?" },
  {
    role: "assistant",
    text: "Booked: Saturday 10:30. I'll hold the dress your size and text you a reminder.",
  },
];

/**
 * A static, self-contained lookalike of the Modern Sleek chat surface.
 *
 * NOT the widget: the real component (components/widget/chat-widget.tsx) is
 * wired to sessions and the live API. This one exists so the landing hero can
 * show the exact widget look — same gradient card, bubbles, product cards and
 * composer — with no session, no network and no way to affect the product.
 * Whenever the widget's appearance changes, mirror those styles here.
 */
export function HeroChat({ className }: { className?: string }) {
  return (
    <div className={cn("flex w-full flex-col items-center rotate-y-5 -rotate-z-7", className)}>
      {/* Conversation card — mirrors .zy-sleek panel styling. */}
      <div className="relative flex h-[42rem] w-full flex-col overflow-hidden rounded-[20px] border border-white/70 bg-[radial-gradient(120%_110%_at_32%_58%,#efe5ff_0%,#f7f4fb_48%,#f3f1f6_100%)] shadow-[0_36px_90px_-24px_rgba(8,6,18,0.78)]">
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 sm:px-6 pt-6 pb-4 [&::-webkit-scrollbar]:hidden">
          <div className="space-y-4.5">
            {HERO_CHAT_SCRIPT.map((turn, index) =>
              turn.role === "user" ? (
                <HeroUserMessage key={index} text={turn.text} />
              ) : (
                <HeroAssistantMessage key={index} turn={turn} />
              ),
            )}
          </div>
        </div>
      </div>

      {/* Composer pill — mirrors the widget's input bar. Static demo: input is
          disabled so the hero can't host a real conversation. */}
      <div className="mt-3 flex w-full items-center gap-0.5 rounded-full border border-white/50 bg-[#e8e5eb]/95 p-1.5 shadow-[0_24px_60px_-18px_rgba(0,0,0,0.7)] backdrop-blur-md">
        <span
          aria-hidden="true"
          className="grid size-8 shrink-0 place-items-center rounded-full text-[#5f5c67]"
        >
          <Plus className="size-4" strokeWidth={2} />
        </span>
        <span className="min-w-0 flex-1 truncate bg-transparent px-1.5 py-1 text-[12.5px] text-[#8f8b97] select-none">
          Ask anything...
        </span>
        <span
          aria-hidden="true"
          className="grid size-8 shrink-0 place-items-center rounded-full text-[#5f5c67]"
        >
          <Mic className="size-4" strokeWidth={2} />
        </span>
        <span
          aria-hidden="true"
          className="grid size-8 shrink-0 place-items-center rounded-full bg-[#0d0c11] text-white shadow-sm"
        >
          <ArrowUp className="size-4" strokeWidth={2.2} />
        </span>
      </div>
    </div>
  );
}

function HeroUserMessage({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-end gap-2.5">
      <div className="max-w-[76%] rounded-[11px] bg-[#0e0d12] px-3.5 py-2.5 text-[12.5px] leading-[1.45] text-white shadow-[0_4px_14px_rgba(0,0,0,0.18)]">
        {text}
      </div>
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#0d0d10] text-white ring-1 ring-black/10">
        <User className="size-3.75" strokeWidth={2} />
      </span>
    </div>
  );
}

function HeroAssistantMessage({ turn }: { turn: HeroChatTurn }) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-start gap-3">
        {/* Same seeded avatar as the widget: dark orb with the sprout. */}
        <span
          aria-hidden="true"
          className="grid size-8 shrink-0 place-items-center rounded-full bg-[radial-gradient(circle_at_32%_28%,#75727d_0%,#26252b_55%,#131217_100%)] ring-1 ring-black/5"
        >
          <Sprout className="mt-1 size-3.5 text-[#7fdc96]" strokeWidth={2.4} />
        </span>
        <div className="min-w-0 pt-0.5">
          <WidgetMarkdown text={turn.text} />
        </div>
      </div>
      {turn.products?.length ? (
        <div className="ml-11 flex gap-2.5 snap-x snap-mandatory overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden">
          {turn.products.map((product) => (
            <HeroProductCard key={product.name} product={product} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Same vertical commerce card as the widget: image on top, name + price
 * below, monogram block when there is no photo yet.
 */
function HeroProductCard({ product }: { product: HeroChatProduct }) {
  return (
    <article
      className={cn(
        "relative w-[min(55vw,13rem)] shrink-0 snap-start snap-always",
        "overflow-hidden rounded-[14px] border border-[#e6e2ee] bg-white",
        "shadow-[0_2px_10px_rgba(20,18,30,0.06)]",
      )}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-[#f6f4f9]">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt={product.name}
            className="size-full object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="grid size-full place-items-center bg-[radial-gradient(circle_at_32%_28%,#75727d_0%,#26252b_55%,#131217_100%)] text-[42px] font-semibold text-white"
          >
            {product.name.trim().charAt(0).toUpperCase()}
          </span>
        )}
      </div>

      <div className="px-3 pb-3 pt-2.5">
        <p className="truncate text-[12.5px] font-semibold text-[#232128]">
          {product.name}
        </p>
        <p className="text-[12px] font-medium text-[#494652]">
          {formatMoney({
            amountMinor: product.priceCents,
            currency: product.currency,
          })}
        </p>
      </div>
    </article>
  );
}
