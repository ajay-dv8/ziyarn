import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  BookOpen,
  CalendarCheck,
  Check,
  Code2,
  CreditCard,
  Globe,
  LifeBuoy,
  Lock,
  Mail,
  ShieldCheck,
  UserRoundCheck,
} from "lucide-react";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Button } from "@repo/ui/components/button";
import { cn } from "@repo/ui/lib/utils";

import { LandingHeader } from "@/components/landing/landing-header";
import { APP_ROUTES } from "@/constants/routes";
import { authService } from "@/services/auth-service";

export const metadata: Metadata = {
  title: "Ziyarn — One AI agent for helpdesk and sales",
  description:
    "Embed one AI agent on your website that answers customer questions from your own knowledge, captures leads, books appointments, takes payments, and hands off to your team in realtime.",
};

/* Direction contract — seed ae10e354.
   THESIS: the spine is the real setup path (create, teach, embed); refuses
   the feature-grid landing because "how" is the buyer's first question.
   OWN-WORLD: inherited app system — neutral ground, deep-green primary owns
   live states and the closing band, Geist Mono for code only, bordered
   surfaces holding real product fragments, no gradients.
   STORY: one viewport to know what Ziyarn is and see it working; the spine
   proves setup is three ordinary moves; the two-job split lands the
   positioning; trust facts close doubt; Start free ends every path.
   FIRST VIEWPORT: split hero — headline + subcopy + Start free left,
   synthetic chat-widget conversation right showing answer-from-knowledge
   then a booking action.
   FORM: how-it-works spine, candidate 4 of 7 grounded structures. */

/** Staggered-once entrance for hero bubbles; static under reduced motion. */
function Bubble({
  delay,
  className,
  children,
}: {
  delay?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      style={delay ? { animationDelay: delay } : undefined}
      className={cn(
        "zy-fade-up opacity-0 motion-reduce:animate-none motion-reduce:opacity-100",
        className,
      )}
    >
      {children}
    </div>
  );
}

function ChatWidgetDemo() {
  return (
    <figure className="w-full max-w-md rounded-2xl border bg-card shadow-sm">
      <div className="flex items-center gap-2.5 border-b px-4 py-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
          Z
        </span>
        <div>
          <p className="text-sm font-medium leading-tight">Akwaba Assistant</p>
          <p className="text-xs text-muted-foreground">
            Always on · replies instantly
          </p>
        </div>
      </div>

      <div className="space-y-3 px-4 py-4 text-sm">
        <Bubble className="max-w-[85%] rounded-2xl rounded-bl-sm bg-muted px-3.5 py-2.5">
          Do you deliver to Kumasi, and how fast?
        </Bubble>
        <Bubble
          delay="200ms"
          className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3.5 py-2.5 text-primary-foreground"
        >
          Yes — Greater Kumasi in 1–2 business days, free over GH₵500. Want me
          to check an item?
        </Bubble>
        <Bubble
          delay="400ms"
          className="max-w-[85%] rounded-2xl rounded-bl-sm bg-muted px-3.5 py-2.5"
        >
          Nice. Can I book a fitting for Saturday?
        </Bubble>
        <Bubble
          delay="600ms"
          className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm border bg-card px-3 py-2.5"
        >
          <p className="font-medium">Saturday fittings</p>
          <div className="mt-1.5 flex gap-1.5">
            <span className="rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
              10:30
            </span>
            <span className="rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
              14:00
            </span>
          </div>
        </Bubble>
      </div>

      <figcaption className="border-t px-4 py-2.5 text-center text-[11px] text-muted-foreground">
        Illustrative conversation — yours will learn your business
      </figcaption>
    </figure>
  );
}

const SETUP_STEPS = [
  {
    title: "Create your workspace",
    body: "Every website gets its own domain — its own agent, knowledge, and embed key. Point Ziyarn at your business and everything stays scoped to it.",
    fragment: (
      <div className="rounded-xl border bg-card p-4 text-sm shadow-sm sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Globe className="h-5 w-5 text-primary" />
            </span>
            <div>
              <p className="font-medium leading-tight">Acme Clothing</p>
              <p className="text-xs text-muted-foreground">acme-clothing</p>
            </div>
          </div>
          <span className="flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Live
          </span>
        </div>
      </div>
    ),
  },
  {
    title: "Teach it your business",
    body: "Upload documents, crawl your website, or connect your PostgreSQL, MySQL, MongoDB, or Convex database. Answers come from your material — never guesswork.",
    fragment: (
      <div className="divide-y rounded-xl border bg-card text-sm shadow-sm">
        <div className="flex items-center gap-3 p-4">
          <BookOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="flex-1 truncate">delivery-policy.pdf</p>
          <span className="flex items-center gap-1 text-xs font-medium text-primary">
            <Check className="h-3.5 w-3.5" /> embedded
          </span>
        </div>
        <div className="flex items-center gap-3 p-4">
          <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="flex-1 truncate">acmeclothing.com — 42 pages crawled</p>
          <span className="flex items-center gap-1 text-xs font-medium text-primary">
            <Check className="h-3.5 w-3.5" /> indexed
          </span>
        </div>
        <div className="flex items-center gap-3 p-4">
          <Code2 className="h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="flex-1 truncate">
            PostgreSQL — products, orders, rooms
          </p>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            ready
          </span>
        </div>
      </div>
    ),
  },
  {
    title: "Paste one snippet",
    body: "Drop a single tag before the closing body tag. The widget inherits your pages, matches your brand, and starts answering immediately.",
    fragment: (
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="border-b px-4 py-2 font-mono text-xs text-muted-foreground">
          index.html
        </div>
        <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed">
          <code>
            <span className="text-muted-foreground">{"<body>"}</span>
            {"\n  "}
            <span className="text-muted-foreground">
              {"<!-- your site -->"}
            </span>
            {"\n  "}
            <span className="font-semibold text-primary">{"<script"}</span>{" "}
            src=
            <span className="text-emerald-700 dark:text-emerald-400">
              &quot;https://widget.ziyarn.com/v1.js&quot;
            </span>
            {"\n         "}data-agent=
            <span className="text-emerald-700 dark:text-emerald-400">
              &quot;YOUR_EMBED_KEY&quot;
            </span>
            <span className="font-semibold text-primary">{"></script>"}</span>
            {"\n"}
            <span className="text-muted-foreground">{"</body>"}</span>
          </code>
        </pre>
      </div>
    ),
  },
] as const;

const SUPPORT_JOB = [
  "Answers customer questions from your docs, site, and data — at 2 a.m. included",
  "Says so and escalates when something isn't in its knowledge — never invents",
  "Hands the conversation to your team in realtime; replies stream back to the visitor",
];

const SALES_JOB = [
  "Qualifies visitors with your questions and captures their email as a lead",
  "Books appointments while intent is hot, confirmed inside the chat",
  "Sells your catalog through secure checkout links the visitor pays on",
];

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
      <LandingHeader />
      <main className="flex flex-1 flex-col">
        {/* hero */}
        <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-6 pb-20 pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:pt-24">
          <div>
            <h1 className="max-w-xl text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
              One AI agent that answers support{" "}
              <span className="text-primary">and</span> closes sales.
            </h1>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
              Ziyarn embeds a trainable agent on your website. It resolves
              customer questions from your own knowledge, qualifies leads,
              books appointments, takes payments — and calls in your team the
              moment a human matters.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button size="lg" render={<Link href={APP_ROUTES.SIGN_UP} />}>
                Start free
              </Button>
              <Button
                size="lg"
                variant="ghost"
                render={<Link href="#how-it-works" />}
              >
                See how it works
              </Button>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Free plan included · live on your site in minutes
            </p>
          </div>

          <div className="flex justify-center lg:justify-end">
            <ChatWidgetDemo />
          </div>
        </section>

        {/* how-it-works spine */}
        <section
          id="how-it-works"
          className="border-y bg-muted/40 py-20 sm:py-24"
        >
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="max-w-2xl text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
              From zero to answering customers in three moves.
            </h2>
            <p className="mt-4 max-w-xl text-lg text-muted-foreground">
              No prompt engineering, no extra tools. Setup is the same whether
              you run a shopfront or a nationwide operation.
            </p>

            <ol className="mt-14 space-y-12">
              {SETUP_STEPS.map((step, index) => (
                <li
                  key={step.title}
                  className="grid items-center gap-8 md:grid-cols-2 md:gap-14"
                >
                  <div className={cn(index % 2 === 1 && "md:order-2")}>
                    <div className="flex items-baseline gap-3">
                      <span className="font-mono text-sm font-medium text-primary">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <h3 className="text-2xl font-semibold tracking-tight">
                        {step.title}
                      </h3>
                    </div>
                    <p className="mt-3 max-w-md leading-relaxed text-muted-foreground">
                      {step.body}
                    </p>
                  </div>
                  <div
                    className={cn(
                      "justify-self-start md:w-full md:justify-self-stretch",
                      index % 2 === 1 && "md:order-1",
                    )}
                  >
                    {step.fragment}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* two jobs */}
        <section className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
          <h2 className="max-w-2xl text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            An agent with two jobs — and one memory.
          </h2>
          <p className="mt-4 max-w-xl text-lg text-muted-foreground">
            Support and sales share the same conversation, the same knowledge,
            and the same embed. Visitors never notice the seam; you stop
            paying for two tools.
          </p>

          <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-2">
            <div className="bg-card p-7">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                  <LifeBuoy className="h-4 w-4 text-primary" />
                </span>
                <h3 className="text-lg font-semibold">The helpdesk job</h3>
              </div>
              <ul className="mt-5 space-y-3">
                {SUPPORT_JOB.map((item) => (
                  <li
                    key={item}
                    className="flex gap-2.5 text-sm leading-relaxed"
                  >
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-card p-7">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                  <CreditCard className="h-4 w-4 text-primary" />
                </span>
                <h3 className="text-lg font-semibold">The sales job</h3>
              </div>
              <ul className="mt-5 space-y-3">
                {SALES_JOB.map((item) => (
                  <li
                    key={item}
                    className="flex gap-2.5 text-sm leading-relaxed"
                  >
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <Mail className="h-4 w-4" /> Leads delivered to your dashboard
            </span>
            <span className="flex items-center gap-2">
              <CalendarCheck className="h-4 w-4" /> Bookings confirmed in-chat
            </span>
            <span className="flex items-center gap-2">
              <LifeBuoy className="h-4 w-4" /> Human handoff built in
            </span>
          </div>
        </section>

        {/* trust */}
        <section className="border-y bg-muted/40 py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="max-w-2xl text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
              Built truthful, built contained.
            </h2>
            <p className="mt-4 max-w-xl text-lg text-muted-foreground">
              An agent speaks for your business. Ziyarn is engineered so it can
              only say what you would.
            </p>
            <div className="mt-12 grid gap-10 sm:grid-cols-3">
              {TRUST_FACTS.map((fact) => (
                <div key={fact.title}>
                  <fact.icon className="h-5 w-5 text-primary" />
                  <h3 className="mt-3 font-semibold">{fact.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
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
              >
                Start free
              </Button>
              <Button
                size="lg"
                variant="ghost"
                className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
                render={<Link href={APP_ROUTES.SIGN_IN} />}
              >
                Sign in
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

