import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import type { Metadata } from "next";

import Navbar from "@/components/landing/navbar";
import DimensionalWorkflowHero from "@/components/ui/dimensional-workflow-hero";
import { APP_ROUTES } from "@/constants/routes";
import { authService } from "@/services/auth-service";
import {
  workflowHeroAccent,
  workflowHeroContent,
  workflowHeroStyle,
} from "@/components/landing/workflow-hero-content";

export const metadata: Metadata = {
  title: "Ziyarn — One AI agent for helpdesk and sales",
  description:
    "Embed one AI agent on your website that answers customer questions from your own knowledge, captures leads, books appointments, takes payments, and hands off to your team in realtime.",
};

export default async function HomePage() {
  const session = await authService.getSession(await headers());
  if (session) {
    redirect(APP_ROUTES.DASHBOARD);
  }

  return (
    <div className="flex min-h-svh flex-col bg-[#05070d]">
      <Navbar />
      {/* Anchor for the navbar's "How it works" link: the whole scroll experience. */}
      <div id="how-it-works">
        <DimensionalWorkflowHero
          content={workflowHeroContent}
          accent={workflowHeroAccent}
          style={workflowHeroStyle}
          className="dark"
        />
      </div>

      <footer
        id="site-footer"
        tabIndex={-1}
        className="border-t border-white/10 bg-[#05070d]"
      >
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-zinc-400 sm:flex-row">
          <p className="font-medium text-zinc-100">Ziyarn</p>
          <nav className="flex flex-wrap items-center justify-center gap-5">
            <Link href={APP_ROUTES.FEATURES} className="hover:text-zinc-100">
              Features
            </Link>
            <Link href={APP_ROUTES.PRICING} className="hover:text-zinc-100">
              Pricing
            </Link>
            <Link href={APP_ROUTES.DOCS} className="hover:text-zinc-100">
              Docs
            </Link>
            <Link href={APP_ROUTES.SIGN_IN} className="hover:text-zinc-100">
              Sign in
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
