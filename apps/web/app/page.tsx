import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Lock, ShieldCheck, UserRoundCheck } from "lucide-react";
import type { Metadata } from "next";

import { Button } from "@repo/ui/components/button";

import HeroPage from "@/components/landing/hero-page";
import { APP_ROUTES } from "@/constants/routes";
import { authService } from "@/services/auth-service";
import Process from "@/components/landing/process";
import { Jobs } from "@/components/landing/jobs";
import Services from "@/components/landing/landing-services";

export const metadata: Metadata = {
  title: "Ziyarn — One AI agent for helpdesk and sales",
  description:
    "Embed one AI agent on your website that answers customer questions from your own knowledge, captures leads, books appointments, takes payments, and hands off to your team in realtime.",
};

/* Direction contract — seed ae10e354.
   THESIS: the spine is the real setup path (create, teach, embed); refuses
   the feature-grid landing because "how" is the buyer's first question.
   OWN-WORLD: dark shader hero (cyan/orange mesh) above an inherited app
   system — neutral ground, deep-green primary owns live states and the
   closing band, Geist Mono for code only, bordered surfaces holding real
   product fragments.
   STORY: one viewport to know what Ziyarn is; the spine proves setup is
   three ordinary moves; the two-job split lands the positioning; trust
   facts close doubt; Start free ends every path.
   FIRST VIEWPORT: full-bleed shader hero — brand nav, headline "One agent
   for support and sales.", subcopy, See how it works + Start free, and the
   pulsing orbit mark.
   FORM: how-it-works spine, candidate 4 of 7 grounded structures. */

const TRUST_FACTS = [
  {
    icon: ShieldCheck,
    title: "Truthful by default",
    body: "Your agent answers only from material you gave it. Outside that, it says so and brings in a human.",
  },
  {
    icon: UserRoundCheck,
    title: "You stay in control",
    body: "Per-domain scoping, owner-only settings, and a human handoff one click away for every visitor.",
  },
  {
    icon: Lock,
    title: "Credentials stay yours",
    body: "Database connections are read-only samples, encrypted at rest. Public chat endpoints are gated and rate-limited.",
  },
];

export default async function HomePage() {
  const session = await authService.getSession(await headers());
  if (session) {
    redirect(APP_ROUTES.DASHBOARD);
  }

  return (
    <div className="flex min-h-svh flex-col">
      {/* HERO */}
      <HeroPage />

      <Process />

      <main className="flex flex-1 flex-col px-40 py-24 bg-gray-50">
        <Services />
        <Jobs />

        {/* trust */}
        <section className="border-y  py-24 sm:py-24">
          <div className=" px-6">
            <h2 className="w-8xl text-balance text-gray-500 text-4xl tracking-tight sm:text-4xl">
              <span className="text-gray-800">
                Your business knowledge. Your rules. Your voice.
              </span>{" "}
              Ziyarn keeps every AI response grounded in your business
              information, helping your agent deliver relevant answers without
              making things up or going beyond its intended role.
            </h2>

            <div className="mt-24 grid gap-8 sm:grid-cols-3 px-20">
              {TRUST_FACTS.map((fact) => (
                <div
                  key={fact.title}
                  className="rounded-2xl border bg-white p-8 shadow-sm"
                >
                  <span className="grid size-11 place-items-center rounded-full bg-primary/10">
                    <fact.icon className="h-5 w-5 text-primary" strokeWidth={2} />
                  </span>
                  <h3 className="mt-6 font-semibold text-gray-600">{fact.title}</h3>
                  <p className="mt-2 leading-relaxed text-muted-foreground">
                    {fact.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* close */}
        <section className="px-6 py-20 sm:py-28">
          <div className="mx-auto max-w-4xl rounded-3xl bg-primary px-8 py-16 text-center text-primary-foreground sm:px-16">
            <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
              Put an agent on your site today.
            </h2>
            <p className="mx-auto mt-4 max-w-md text-lg leading-relaxed opacity-90">
              Start on the free plan, teach it in an afternoon, and never miss
              another after-hours customer.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button
                size="lg"
                variant="secondary"
                render={<Link href={APP_ROUTES.SIGN_UP} />}
                className=" px-16 py-8 rounded-full text-primary font-semibold bg-white hover:bg-white hover:scale-105 transition-transform duration-500"
              >
                GET STARTED FOR FREE
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-muted-foreground sm:flex-row">
          <p className="font-medium text-foreground">Ziyarn</p>
          <nav className="flex flex-wrap items-center justify-center gap-5">
            <Link href={APP_ROUTES.FEATURES} className="hover:text-foreground">
              Features
            </Link>
            <Link href={APP_ROUTES.PRICING} className="hover:text-foreground">
              Pricing
            </Link>
            <Link href={APP_ROUTES.DOCS} className="hover:text-foreground">
              Docs
            </Link>
            <Link href={APP_ROUTES.SIGN_IN} className="hover:text-foreground">
              Sign in
            </Link>
          </nav>
        </div>
      </footer>

      {/* Direction contract — survives the build for audit (seed ae10e354). */}
      <script
        type="application/x-impeccable-contract"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            seed: "ae10e354",
            form: "how-it-works spine, candidate 4 of 7 grounded structures",
          }),
        }}
      />
    </div>
  );
}
