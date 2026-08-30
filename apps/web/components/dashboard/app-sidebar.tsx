"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Card, CardContent } from "@repo/ui/components/card";
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
import {
  BarChart3,
  BookOpen,
  Bot,
  Calendar,
  ChevronRight,
  CreditCard,
  Gauge,
  Globe,
  LayoutDashboard,
  Mail,
  MessagesSquare,
  Plug,
  Settings,
  ShoppingBag,
  Sparkles,
  UsersRound,
} from "lucide-react";

import { ZiyarnLogo } from "@/assets/logo/ziyarn-logo";
import { APP_ROUTES } from "@/constants/routes";
import { CreateDomainButton } from "@/components/domains/create-domain-button";
import { useUnreadCount } from "@/hooks/use-unread-count";

const COMING_SOON: { title: string; icon: typeof Settings }[] = [];

export function AppSidebar({
  plan,
  domainCount,
  maxDomains,
  domains,
}: {
  plan: string;
  domainCount: number;
  maxDomains: number;
  domains: { id: string; name: string }[];
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeDomainId = searchParams.get("domainId");
  const totalUnread = useUnreadCount();
  const [domainsOpen, setDomainsOpen] = useState(
    pathname.startsWith("/dashboard/domains") ||
      pathname.startsWith("/dashboard/agents") ||
      pathname.startsWith("/dashboard/knowledge") ||
      pathname.startsWith("/dashboard/analytics"),
  );

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
                isActive={pathname === APP_ROUTES.DASHBOARD_DOMAINS}
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
                            href={`/dashboard/domains?domainId=${domain.id}`}
                          />
                        }
                      >
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
                render={<Link href={APP_ROUTES.DASHBOARD_CONVERSATIONS} />}
              >
                <MessagesSquare />
                <span>Conversations</span>
              </SidebarMenuButton>
              {totalUnread > 0 && (
                <SidebarMenuBadge className="bg-destructive text-destructive-foreground">
                  {totalUnread}
                </SidebarMenuBadge>
              )}
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={pathname === APP_ROUTES.DASHBOARD_BOOKINGS}
                tooltip="Bookings"
                render={<Link href={APP_ROUTES.DASHBOARD_BOOKINGS} />}
              >
                <Calendar />
                <span>Bookings</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={pathname === APP_ROUTES.DASHBOARD_AGENTS}
                tooltip="Agents"
                render={<Link href={APP_ROUTES.DASHBOARD_AGENTS} />}
              >
                <Bot />
                <span>Agents</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={pathname === APP_ROUTES.DASHBOARD_KNOWLEDGE}
                tooltip="Knowledge Base"
                render={<Link href={APP_ROUTES.DASHBOARD_KNOWLEDGE} />}
              >
                <BookOpen />
                <span>Knowledge Base</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={pathname === APP_ROUTES.DASHBOARD_ANALYTICS}
                tooltip="Analytics"
                render={<Link href={APP_ROUTES.DASHBOARD_ANALYTICS} />}
              >
                <BarChart3 />
                <span>Analytics</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={pathname === APP_ROUTES.DASHBOARD_USAGE}
                tooltip="Usage"
                render={<Link href={APP_ROUTES.DASHBOARD_USAGE} />}
              >
                <Gauge />
                <span>Usage</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={pathname === APP_ROUTES.DASHBOARD_CUSTOMERS}
                tooltip="Customers"
                render={<Link href={APP_ROUTES.DASHBOARD_CUSTOMERS} />}
              >
                <UsersRound />
                <span>Customers</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={pathname === APP_ROUTES.DASHBOARD_CAMPAIGNS}
                tooltip="Campaigns"
                render={<Link href={APP_ROUTES.DASHBOARD_CAMPAIGNS} />}
              >
                <Mail />
                <span>Campaigns</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={pathname === APP_ROUTES.DASHBOARD_PRODUCTS}
                tooltip="Products"
                render={<Link href={APP_ROUTES.DASHBOARD_PRODUCTS} />}
              >
                <ShoppingBag />
                <span>Products</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={pathname === APP_ROUTES.DASHBOARD_BILLING}
                tooltip="Billing"
                render={<Link href={APP_ROUTES.DASHBOARD_BILLING} />}
              >
                <CreditCard />
                <span>Billing</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={pathname === APP_ROUTES.DASHBOARD_INTEGRATIONS}
                tooltip="Integrations"
                render={<Link href={APP_ROUTES.DASHBOARD_INTEGRATIONS} />}
              >
                <Plug />
                <span>Integrations</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={pathname === APP_ROUTES.DASHBOARD_SETTINGS}
                tooltip="Settings"
                render={<Link href={APP_ROUTES.DASHBOARD_SETTINGS} />}
              >
                <Settings />
                <span>Settings</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Coming soon</SidebarGroupLabel>
          <SidebarMenu>
            {COMING_SOON.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  disabled
                  tooltip={`${item.title} — coming soon`}
                  className="cursor-not-allowed text-muted-foreground"
                >
                  <item.icon />
                  <span>{item.title}</span>
                  <SidebarMenuBadge className="bg-secondary text-muted-foreground">
                    Soon
                  </SidebarMenuBadge>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <Card className="w-full border-none bg-secondary/60 shadow-none">
              <CardContent className="flex items-center gap-3 p-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Sparkles size={14} className="text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium capitalize leading-tight">
                    {plan} plan
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {domainCount} of {maxDomains} domains
                  </p>
                </div>
              </CardContent>
            </Card>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
