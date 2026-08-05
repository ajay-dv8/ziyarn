import type { Metadata } from "next";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { Code2, Globe, KeyRound } from "lucide-react";

import { LandingHeader } from "@/components/landing/landing-header";

export const metadata: Metadata = {
  title: "Docs",
};

export default function DocsPage() {
  return (
    <div className="flex min-h-svh flex-col">
      <LandingHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Getting started
          </h1>
          <p className="text-muted-foreground">
            Embed the Ziyarn widget in three steps.
          </p>
        </div>

        <div className="mt-12 space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                  <Globe size={16} className="text-primary" />
                </div>
                <CardTitle>1. Create a domain</CardTitle>
              </div>
              <CardDescription>
                Sign in and create a domain from the dashboard. A domain is
                your helpdesk — it gets its own agent, embed secret, and
                widget.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                  <KeyRound size={16} className="text-primary" />
                </div>
                <CardTitle>2. Copy your embed secret</CardTitle>
              </div>
              <CardDescription>
                Your domain has an embed secret that authorizes the widget.
                Keep it private — never commit it to client-side code that
                others can read.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                  <Code2 size={16} className="text-primary" />
                </div>
                <CardTitle>3. Add the widget to your site</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription className="mb-4">
                Paste this before the closing tag of your page. The widget
                handles the rest — conversations, escalation, and realtime
                owner replies.
              </CardDescription>
              <pre className="overflow-x-auto rounded-lg bg-secondary p-4 text-xs leading-relaxed">
                <code>{`<zy-widget
  data-slug="your-domain-slug"
  data-secret="YOUR_EMBED_SECRET"
  data-title="Acme Support"
  data-subtitle="Ask us anything"
></zy-widget>
<script src="https://YOUR_APP_URL/widget.js"></script>`}</code>
              </pre>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
