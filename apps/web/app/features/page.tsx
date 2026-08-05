import type { Metadata } from "next";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { BookOpen, MessagesSquare, Sparkles, Workflow } from "lucide-react";

import { LandingHeader } from "@/components/landing/landing-header";

export const metadata: Metadata = {
  title: "Features",
};

const FEATURES = [
  {
    icon: Sparkles,
    title: "AI helpdesk agent",
    description:
      "Your widget answers visitor questions from your knowledge base around the clock, in your tone of voice.",
  },
  {
    icon: MessagesSquare,
    title: "Realtime human handoff",
    description:
      "When the agent can't help, it escalates the conversation to you — owner replies stream to the visitor's widget in realtime.",
  },
  {
    icon: Workflow,
    title: "Sales qualification",
    description:
      "The agent captures leads, asks qualifying questions, and passes them to your team ready to close.",
  },
  {
    icon: BookOpen,
    title: "Knowledge base",
    description:
      "Point the agent at your docs and FAQs so it answers from your content — not guesswork. Arriving soon.",
  },
] as const;

export default function FeaturesPage() {
  return (
    <div className="flex min-h-svh flex-col">
      <LandingHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-16">
        <div className="space-y-3 text-center">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Everything your business needs to never miss a lead
          </h1>
          <p className="mx-auto max-w-xl text-muted-foreground">
            One embed gives you an AI agent that answers, qualifies, and hands
            off to your team — no separate tools required.
          </p>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <Card key={feature.title}>
              <CardHeader>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <feature.icon size={18} className="text-primary" />
                </div>
                <CardTitle className="mt-3">{feature.title}</CardTitle>
                <CardDescription>{feature.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
