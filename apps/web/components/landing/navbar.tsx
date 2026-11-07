"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";

import { APP_ROUTES } from "@/constants/routes";

const LINKS = [
  { label: "How it works", href: "#how-it-works" },
  { label: "Features", href: APP_ROUTES.FEATURES },
  { label: "Pricing", href: APP_ROUTES.PRICING },
  { label: "Docs", href: APP_ROUTES.DOCS },
];

export default function Navbar() {
  const [scrolled, setScrolled] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToHowItWorks = () => {
    setMenuOpen(false);
    document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" });
  };

  // Over the dark hero the bar is transparent with light text; once scrolled
  // into the light sections it turns into a white glass bar with dark text.
  const dark = !scrolled;
  const linkColor = dark ? "text-white/85 hover:text-white" : "text-gray-100 hover:text-gray-300";

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled ? "border-b border-black/5 bg-white/5 shadow-sm backdrop-blur-md" : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 items-center justify-between px-4 md:px-32">
        <Link
          href="/"
          className={`text-2xl font-bold tracking-tight transition-colors ${
            dark ? "text-white" : "text-gray-200"
          }`}
        >
          Ziyarn
        </Link>

        {/* Desktop links */}
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {LINKS.map((link) =>
            link.href.startsWith("#") ? (
              <button
                key={link.label}
                type="button"
                onClick={scrollToHowItWorks}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${linkColor}`}
              >
                {link.label}
              </button>
            ) : (
              <Link
                key={link.label}
                href={link.href}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${linkColor}`}
              >
                {link.label}
              </Link>
            ),
          )}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            href={APP_ROUTES.SIGN_IN}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${linkColor}`}
          >
            Login
          </Link>
          <Link
            href={APP_ROUTES.SIGN_UP}
            className="rounded-full bg-green-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-green-700"
          >
            Get Started
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-label="Toggle navigation"
          className={`rounded-full p-2 transition-colors md:hidden ${
            dark ? "text-white hover:bg-white/10" : "text-gray-900 hover:bg-black/5"
          }`}
        >
          {menuOpen ? (
            <X className="size-6" aria-hidden />
          ) : (
            <Menu className="size-6" aria-hidden />
          )}
        </button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.nav
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            aria-label="Mobile"
            className="mx-4 mb-4 flex flex-col gap-1 rounded-2xl border border-black/5 bg-white p-3 shadow-xl md:hidden"
          >
            {LINKS.map((link) =>
              link.href.startsWith("#") ? (
                <button
                  key={link.label}
                  type="button"
                  onClick={scrollToHowItWorks}
                  className="rounded-xl px-4 py-3 text-left text-base font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-950"
                >
                  {link.label}
                </button>
              ) : (
                <Link
                  key={link.label}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-xl px-4 py-3 text-base font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-950"
                >
                  {link.label}
                </Link>
              ),
            )}
            <div className="mt-2 flex flex-col gap-2 border-t border-gray-100 pt-3">
              <Link
                href={APP_ROUTES.SIGN_IN}
                onClick={() => setMenuOpen(false)}
                className="rounded-xl px-4 py-3 text-center text-base font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-950"
              >
                Login
              </Link>
              <Link
                href={APP_ROUTES.SIGN_UP}
                onClick={() => setMenuOpen(false)}
                className="rounded-xl bg-green-600 px-4 py-3 text-center text-base font-semibold text-white hover:bg-green-700"
              >
                Get Started
              </Link>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
