import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";

import { getPlanLimits, type Plan } from "@repo/api/plans";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { Separator } from "@repo/ui/components/separator";
import {
  ArrowRight,
  BookOpen,
  Code2,
  Globe,
  MessagesSquare,
  Sparkles,
  Zap,
} from "lucide-react";

import { APP_ROUTES } from "@/constants/routes";
import { chatService } from "@/services/chat-service";
import { domainsService } from "@/services/domains-service";

export const metadata: Metadata = {
  title: "Overview",
};

const PLAN_RANK: Record<Plan, number> = {
  free: 0,
  standard: 1,
  pro: 2,
  ultimate: 3,
};

export default async function DashboardPage() {
  const domains = await domainsService.listDomains(await headers());

  if (domains.length === 0) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="max-w-md border-dashed text-center">
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
              <Globe size={22} className="text-primary" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-lg font-semibold">Create your first domain</h2>
              <p className="text-sm text-muted-foreground">
                A domain is your helpdesk — it gets its own AI agent and embed
                widget. Set one up to get started.
              </p>
            </div>
            <Button render={<Link href={APP_ROUTES.DASHBOARD_DOMAINS} />}>
              Create a domain
              <ArrowRight />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const plan = domains.reduce<Plan>(
    (best, domain) =>
      PLAN_RANK[domain.plan] > PLAN_RANK[best] ? domain.plan : best,
    "free",
  );
  const limits = getPlanLimits(plan);
  const conversationsToday = (
    await Promise.all(
      domains.map((domain) =>
        chatService.countDomainConversationsToday(domain.id),
      ),
    )
  ).reduce((sum, count) => sum + count, 0);

  const stats = [
    {
      label: "Domains",
      value: String(domains.length),
      sub: `of ${limits.maxDomains} allowed`,
      icon: Globe,
    },
    {
      label: "Conversations today",
      value: String(conversationsToday),
      sub: `of ${limits.conversationsPerDay} per day`,
      icon: MessagesSquare,
    },
    {
      label: "AI credits / month",
      value: String(limits.creditsPerMonth),
      sub: "included with your plan",
      icon: Zap,
    },
    {
      label: "Plan",
      value: plan.charAt(0).toUpperCase() + plan.slice(1),
      sub: "manage in billing",
      icon: Sparkles,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="text-sm text-muted-foreground">
          Your AI helpdesk at a glance.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-start justify-between gap-3 pt-4">
              <div className="space-y-1.5">
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="text-3xl font-semibold tracking-tight">
                  {stat.value}
                </p>
                <p className="text-xs text-muted-foreground">{stat.sub}</p>
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <stat.icon size={18} className="text-primary" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent domains</CardTitle>
            <CardDescription>
              The domains powering your helpdesk.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {domains.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No domains yet — create your first one above.
              </p>
            ) : (
              <ul className="divide-y">
                {domains.map((domain) => (
                  <li key={domain.id}>
                    <Link
                      href={APP_ROUTES.DASHBOARD_DOMAINS}
                      className="group flex items-center justify-between gap-4 rounded-lg px-2 py-3 -mx-2 transition-colors hover:bg-accent/50"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
                          <Globe size={16} className="text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {domain.name}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            ziyarn.vercel.app/widget/{domain.slug} · created{" "}
                            {domain.createdAt.toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <Badge
                          variant="secondary"
                          className="rounded-full capitalize"
                        >
                          {domain.plan}
                        </Badge>
                        <ArrowRight
                          size={16}
                          className="text-muted-foreground transition-transform group-hover:translate-x-0.5"
                        />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick actions</CardTitle>
            <CardDescription>Common next steps.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              variant="outline"
              className="w-full justify-between"
              render={<Link href={APP_ROUTES.DASHBOARD_DOMAINS} />}
            >
              Create a domain
              <Globe size={16} />
            </Button>
            <Button
              variant="outline"
              disabled
              title="Coming soon"
              className="w-full justify-between"
            >
              Embed the widget
              <Code2 size={16} />
            </Button>
            <Button
              variant="outline"
              disabled
              title="Coming soon"
              className="w-full justify-between"
            >
              Add to knowledge base
              <BookOpen size={16} />
            </Button>
            <Separator />
            <p className="text-xs text-muted-foreground">
              Widget embed and knowledge base arrive in an upcoming release.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
