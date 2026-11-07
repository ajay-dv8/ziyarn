import type { CSSProperties } from "react";

import {
  APP_ROUTES,
} from "@/constants/routes";
import type { ScrollExperienceContent } from "@/components/ui/dimensional-workflow-hero";

/**
 * Content for the scroll-driven hero experience. All copy is reused from the
 * landing page's own sections (jobs, process, trust) so the page keeps one voice.
 */
export const workflowHeroContent: ScrollExperienceContent = {
  ariaLabel: "Ziyarn — one AI agent for support and sales",
  skip: { label: "Skip animated demonstration", target: "#site-footer" },
  intro: {
    eyebrow: "ZIYARN WAS BUILT AROUND YOUR CUSTOMERS",
    title: { lines: ["One AI agent for", "support and sales."], emphasis: "support and sales." },
    description: [
      "Answers customer questions from your own",
      "knowledge, captures leads, books appointments,",
      "and hands off to your team in realtime.",
    ],
    cta: "See how it works",
  },
  chapters: [
    {
      kind: "workflow",
      name: "Help desk",
      tag: "THE HELPDESK JOB",
      title: ["A helpful answer.", "A human when it matters."],
      description:
        "Customers ask right on your site. Your agent answers from the material you gave it — and brings in your team the moment a question needs a human.",
      color: "#55baff",
      steps: [
        { title: "Customer asks", body: "A question comes in through your website chat." },
        {
          title: "Grounded answer",
          body: "The agent answers only from your docs, site, and data — at 2 a.m. included.",
        },
        {
          title: "Resolve or hand off",
          body: "Known answers go out instantly; anything else reaches your team in realtime.",
        },
      ],
      status: "Knowledge connected",
      diagram: {
        nodes: [
          { icon: "message-square", label: "Customer asks", caption: "WEBSITE CHAT", x: 5, y: 34, step: 0, color: "#55baff" },
          { icon: "bot", label: "Ziyarn agent", caption: "YOUR KNOWLEDGE", x: 35, y: 34, step: 1, color: "#b18aff" },
          { icon: "check", label: "Answer sent", caption: "RESOLVED", x: 74, y: 17, step: 2, color: "#55e2a0" },
          { icon: "user-round", label: "Human handoff", caption: "IN REALTIME", x: 74, y: 57, step: 2, color: "#ffc66c" },
        ],
        edges: [
          { from: 0, to: 1 },
          { from: 1, to: 2 },
          { from: 1, to: 3 },
        ],
        note: "ONE QUESTION · TWO HONEST OUTCOMES",
        gradient: ["#55baff", "#b18aff", "#55e2a0"],
      },
    },
    {
      kind: "workflow",
      name: "Sales",
      tag: "THE SALES JOB",
      title: ["While intent is hot.", "Without lifting a finger."],
      description:
        "The same agent sells: it qualifies visitors with your questions, captures their email as a lead, books appointments, and sends secure checkout links.",
      color: "#55e2a0",
      steps: [
        { title: "Visitor lands", body: "A prospect opens your chat while browsing." },
        {
          title: "Qualify & capture",
          body: "Your questions, asked in order; the email saved as a lead.",
        },
        {
          title: "Book or sell",
          body: "An appointment confirmed in chat, or a secure checkout link the visitor pays on.",
        },
      ],
      status: "Lead pipeline live",
      diagram: {
        nodes: [
          { icon: "message-square", label: "Visitor lands", caption: "OPENS CHAT", x: 5, y: 19, step: 0, color: "#55baff" },
          { icon: "bot", label: "Qualifies intent", caption: "YOUR QUESTIONS", x: 35, y: 19, step: 1, color: "#b18aff" },
          { icon: "database", label: "Lead captured", caption: "EMAIL SAVED", x: 72, y: 19, step: 2, color: "#55e2a0" },
          { icon: "bell", label: "Books or sells", caption: "CHECKOUT LINK", x: 35, y: 65, step: 2, color: "#f07dcc" },
        ],
        edges: [
          { from: 0, to: 1 },
          { from: 1, to: 2 },
          { from: 1, to: 3, out: "bottom", in: "top" },
        ],
        note: "ONE VISITOR · ONE CONVERSATION THAT SELLS",
        gradient: ["#55e2a0", "#55baff", "#b18aff"],
      },
    },
    {
      kind: "build",
      name: "Setup",
      tag: "LIVE IN MINUTES",
      title: ["Three ordinary moves.", "Then it answers."],
      description:
        "Create a workspace, teach it your business, and embed one snippet. No prompt engineering and no extra tools.",
      color: "#ffc66c",
      steps: [
        {
          title: "Create your workspace",
          body: "Its own AI agent, knowledge base, domain, and embed key.",
        },
        {
          title: "Teach your business",
          body: "Upload documents, crawl your site, or connect your database.",
        },
        {
          title: "Embed the widget",
          body: "One snippet before your closing body tag — branded and live.",
        },
      ],
      status: "Embed key ready",
      footer: "Your workspace · Your knowledge · Your website",
      finishedSite: {
        src: "/hero/app-screen.png",
        alt: "The Ziyarn dashboard showing an agent workspace with its knowledge base and live chat",
        label: "Ziyarn · Your workspace",
        width: 1445,
        height: 970,
      },
    },
  ],
  finale: {
    eyebrow: "START FREE",
    title: { lines: ["Put Ziyarn on", "your site today."], emphasis: "Ziyarn" },
    cta: { label: "Get started free", href: APP_ROUTES.SIGN_UP },
  },
  navLabel: "Choose a chapter",
  footer: {
    disclaimer: "YOUR KNOWLEDGE · YOUR RULES · YOUR VOICE",
    scrollHint: "SCROLL TO EXPLORE",
  },
};

/** Dark instance theme — the hero renders dark while the rest of the site stays light. */
export const workflowHeroStyle = {
  "--color-background": "#05070d",
  "--color-foreground": "#f4f7ff",
  "--color-card": "#0d1526",
  "--color-card-foreground": "#f4f7ff",
  "--color-muted-foreground": "#93a5c4",
  "--color-border": "rgba(148, 178, 255, 0.16)",
  "--color-primary": "#16a34a",
  "--color-primary-foreground": "#ffffff",
  "--color-hero-action": "#16a34a",
  "--color-hero-action-ink": "#ffffff",
  "--workflow-shadow-color": "#010409",
  "--workflow-panel-accent": "#4ade80",
  "--workflow-signal-color": "#4ade80",
  "--workflow-code-purple": "#a78bfa",
  "--workflow-code-blue": "#60a5fa",
  "--workflow-code-gold": "#fbbf24",
  "--workflow-panel-background": "#0d1526",
  "--workflow-panel-foreground": "#f4f7ff",
  "--workflow-panel-muted": "#93a5c4",
  "--workflow-canvas-background": "#0a1120",
  "--workflow-panel-border": "rgba(148, 178, 255, 0.16)",
} as CSSProperties;

export const workflowHeroAccent = "#4ade80";
