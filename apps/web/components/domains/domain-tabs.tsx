import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { BookOpen, Bot, Globe } from "lucide-react";

import { APP_ROUTES } from "@/constants/routes";

/**
 * The sections that live inside a single domain.
 *
 * Only sections whose page already scopes itself by `?domainId=` belong here.
 * Conversations, Customers, Bookings, Orders, Products and Campaigns do NOT
 * accept the param yet — see plan/domain-tabs-plan.md, Stage 2 — so listing
 * them would offer a tab that silently shows every domain's data mixed
 * together. Adding one here is a deliberate two-step: make the page scope
 * itself first, then list it.
 */
const TABS: {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
}[] = [
  {
    key: "overview",
    label: "Overview",
    href: APP_ROUTES.DASHBOARD_DOMAINS,
    icon: Globe,
  },
  {
    key: "agents",
    label: "Agents",
    href: APP_ROUTES.DASHBOARD_AGENTS,
    icon: Bot,
  },
  {
    key: "knowledge",
    label: "Knowledge",
    href: APP_ROUTES.DASHBOARD_KNOWLEDGE,
    icon: BookOpen,
  },
];

/**
 * Tab bar for the sections inside one domain.
 *
 * Every href carries `domainId` — that is the whole invariant, and the reason
 * the sidebar's domain sub-list can be the only domain switcher. Drop it and
 * moving sideways silently lands on `domains[0]`.
 *
 * `agentId` is forwarded onto the Knowledge tab so switching tabs does not lose
 * the agent the user had selected.
 *
 * `active` is passed in rather than derived from `usePathname()`: every page
 * that renders this already knows which section it is, and a server component
 * costs no client JavaScript.
 */
export function DomainTabs({
  domainId,
  active,
  agentId,
}: {
  domainId: string;
  active: string;
  agentId?: string;
}) {
  return (
    <nav
      aria-label="Domain sections"
      className="flex flex-wrap gap-1 border-b"
    >
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        const params = new URLSearchParams({ domainId });
        if (tab.key === "knowledge" && agentId) {
          params.set("agentId", agentId);
        }
        return (
          <Link
            key={tab.key}
            href={`${tab.href}?${params.toString()}`}
            aria-current={isActive ? "page" : undefined}
            className={[
              "flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            <tab.icon className="size-4" aria-hidden="true" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
