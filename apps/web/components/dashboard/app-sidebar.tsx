"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";

import { CardContent } from "@repo/ui/components/card";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@repo/ui/components/sidebar";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  BookOpen,
  Building2,
  Calendar,
  ChevronRight,
  CreditCard,
  Gauge,
  Globe,
  LayoutDashboard,
  Mail,
  MessagesSquare,
  Package,
  Plug,
  Settings,
  ShoppingBag,
  Users,
  UsersRound,
} from "lucide-react";

import { ZiyarnLogo } from "@/assets/logo/ziyarn-logo";
import { APP_ROUTES } from "@/constants/routes";
import { CreateDomainButton } from "@/components/domains/create-domain-button";
import { DomainLogo } from "@/components/domains/domain-logo";
import { UserMenu } from "@/components/dashboard/user-menu";
import { useNotificationSummary } from "@/hooks/use-notification-summary";
import {
  getBusinessTypeConfig,
  type BusinessType,
} from "@repo/api/domains/business-types";

/**
 * Routes that live INSIDE a domain. They are reached from the domain page's tab
 * bar rather than from here, but the Domains group must still read as open and
 * active while the user is in one — otherwise the nav appears to lose the
 * section they are in.
 */
const DOMAIN_SCOPED_PATHS = [
  APP_ROUTES.DASHBOARD_DOMAINS,
  APP_ROUTES.DASHBOARD_AGENTS,
  APP_ROUTES.DASHBOARD_KNOWLEDGE,
  APP_ROUTES.DASHBOARD_DATABASES,
];

type WorkspaceLink = {
  label: string;
  href: string;
  icon: LucideIcon;
  active?: boolean;
  external?: boolean;
};

export function AppSidebar({
  plan,
  name,
  email,
  domains,
}: {
  plan: string;
  name: string;
  email: string;
  domains: {
    id: string;
    name: string;
    logoUrl: string | null;
    businessType: BusinessType | null;
  }[];
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeDomainId = searchParams.get("domainId");
  const { openEscalatedCount } = useNotificationSummary();
  const inDomainSection = DOMAIN_SCOPED_PATHS.some((path) =>
    pathname.startsWith(path),
  );
  const [domainsOpen, setDomainsOpen] = useState(
    inDomainSection || pathname.startsWith(APP_ROUTES.DASHBOARD_ANALYTICS),
  );

  const selectedDomain = domains.find((domain) => domain.id === activeDomainId);
  const businessConfig = getBusinessTypeConfig(selectedDomain?.businessType);
  const labels = businessConfig.labels;
  const firstName = name.trim().split(/\s+/)[0] || name;
  const domainHref = (path: string) => {
    if (!selectedDomain) return path;
    const separator = path.includes("?") ? "&" : "?";
    return `${path}${separator}domainId=${encodeURIComponent(selectedDomain.id)}`;
  };

  const workspaceLinks: WorkspaceLink[] = [
    ...(businessConfig.showBookings
      ? [
          {
            label: labels.bookings,
            href: domainHref(APP_ROUTES.DASHBOARD_BOOKINGS),
            icon: Calendar,
            active: pathname === APP_ROUTES.DASHBOARD_BOOKINGS,
          },
        ]
      : []),
    {
      label: "Analytics",
      href: domainHref(APP_ROUTES.DASHBOARD_ANALYTICS),
      icon: BarChart3,
      active: pathname === APP_ROUTES.DASHBOARD_ANALYTICS,
    },
    {
      label: "Usage",
      href: APP_ROUTES.DASHBOARD_USAGE,
      icon: Gauge,
      active: pathname === APP_ROUTES.DASHBOARD_USAGE,
    },
    {
      label: labels.customers,
      href: domainHref(APP_ROUTES.DASHBOARD_CUSTOMERS),
      icon: UsersRound,
      active: pathname === APP_ROUTES.DASHBOARD_CUSTOMERS,
    },
    {
      label: labels.orders,
      href: domainHref(APP_ROUTES.DASHBOARD_ORDERS),
      icon: Package,
      active: pathname === APP_ROUTES.DASHBOARD_ORDERS,
    },
    {
      label: "Campaigns",
      href: APP_ROUTES.DASHBOARD_CAMPAIGNS,
      icon: Mail,
      active: pathname === APP_ROUTES.DASHBOARD_CAMPAIGNS,
    },
    {
      label: labels.productsPlural,
      href: domainHref(APP_ROUTES.DASHBOARD_PRODUCTS),
      icon: ShoppingBag,
      active: pathname === APP_ROUTES.DASHBOARD_PRODUCTS,
    },
    {
      label: "Billing",
      href: APP_ROUTES.DASHBOARD_BILLING,
      icon: CreditCard,
      active: pathname === APP_ROUTES.DASHBOARD_BILLING,
    },
    {
      label: "Integrations",
      href: APP_ROUTES.DASHBOARD_INTEGRATIONS,
      icon: Plug,
      active: pathname === APP_ROUTES.DASHBOARD_INTEGRATIONS,
    },
    {
      label: "Workspaces",
      href: APP_ROUTES.DASHBOARD_WORKSPACES,
      icon: Building2,
      active: pathname.startsWith(APP_ROUTES.DASHBOARD_WORKSPACES),
    },
    {
      label: "Team",
      href: APP_ROUTES.DASHBOARD_TEAM,
      icon: Users,
      active: pathname === APP_ROUTES.DASHBOARD_TEAM,
    },
    {
      label: "Settings",
      href: APP_ROUTES.DASHBOARD_SETTINGS,
      icon: Settings,
      active: pathname === APP_ROUTES.DASHBOARD_SETTINGS,
    },
    {
      label: "Docs",
      href: APP_ROUTES.DOCS,
      icon: BookOpen,
      external: true,
    },
  ];

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="px-3"
              render={<Link href={APP_ROUTES.DASHBOARD} />}
            >
              <ZiyarnLogo className="group-data-[collapsible=icon]:[&>span:last-child]:hidden group-data-[collapsible=icon]:[&_svg]:h-4 group-data-[collapsible=icon]:[&_svg]:w-auto" />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={pathname === APP_ROUTES.DASHBOARD}
                tooltip="Overview"
                render={<Link href={APP_ROUTES.DASHBOARD} />}
              >
                <LayoutDashboard />
                <span>Overview</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={inDomainSection}
                tooltip="Domains"
                onClick={() => setDomainsOpen(!domainsOpen)}
              >
                <Globe />
                <span>Domains</span>
                <ChevronRight
                  className={`ml-auto h-4 w-4 transition-transform duration-200 ${
                    domainsOpen ? "rotate-90" : ""
                  }`}
                />
              </SidebarMenuButton>
              {domainsOpen && (
                <SidebarMenuSub>
                  {domains.map((domain) => (
                    <SidebarMenuSubItem key={domain.id}>
                      <SidebarMenuSubButton
                        isActive={activeDomainId === domain.id}
                        render={
                          <Link
                            href={`${APP_ROUTES.DASHBOARD_DOMAINS}?domainId=${domain.id}`}
                          />
                        }
                      >
                        <DomainLogo
                          name={domain.name}
                          logoUrl={domain.logoUrl}
                          size="xs"
                        />
                        <span>{domain.name}</span>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  ))}
                  <SidebarMenuSubItem>
                    <CreateDomainButton variant="sub" />
                  </SidebarMenuSubItem>
                </SidebarMenuSub>
              )}
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={pathname === APP_ROUTES.DASHBOARD_CONVERSATIONS}
                tooltip="Conversations"
                render={
                  <Link href={domainHref(APP_ROUTES.DASHBOARD_CONVERSATIONS)} />
                }
              >
                <MessagesSquare />
                <span>Conversations</span>
              </SidebarMenuButton>
              {openEscalatedCount > 0 && (
                <SidebarMenuBadge
                  className="bg-destructive text-destructive-foreground"
                  aria-label={`${openEscalatedCount} escalated ${
                    openEscalatedCount === 1 ? "conversation" : "conversations"
                  }`}
                >
                  {openEscalatedCount > 99 ? "99+" : openEscalatedCount}
                </SidebarMenuBadge>
              )}
            </SidebarMenuItem>
            {/* Agents and Knowledge are not listed here. They live inside a
                domain now — see DomainTabs and plan/domain-tabs-plan.md. Their
                routes still work, so old bookmarks are fine. */}
            {workspaceLinks.map(
              ({ label, href, icon: Icon, active, external }) => (
                <SidebarMenuItem key={label}>
                  <SidebarMenuButton
                    isActive={active}
                    tooltip={label}
                    render={
                      <Link
                        href={href}
                        target={external ? "_blank" : undefined}
                        rel={external ? "noreferrer noopener" : undefined}
                      />
                    }
                  >
                    <Icon />
                    <span>{label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ),
            )}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <CardContent className="flex items-center bg-secondary/60 gap-3 p-3">
              {/* The account menu lives here on desktop; the header only keeps it on mobile. */}
              <UserMenu email={email} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium leading-tight">
                  {firstName}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {plan} plan
                </p>
              </div>
            </CardContent>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
