"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
  SidebarRail,
} from "@repo/ui/components/sidebar";
import {
  BookOpen,
  Bot,
  CreditCard,
  Globe,
  LayoutDashboard,
  Mail,
  MessagesSquare,
  Plug,
  Settings,
  Sparkles,
} from "lucide-react";

import { ZiyarnLogo } from "@/assets/logo/ziyarn-logo";
import { APP_ROUTES } from "@/constants/routes";

const COMING_SOON = [
  { title: "Agents", icon: Bot },
  { title: "Knowledge Base", icon: BookOpen },
  { title: "Settings", icon: Settings },
];

export function AppSidebar({
  plan,
  domainCount,
  maxDomains,
}: {
  plan: string;
  domainCount: number;
  maxDomains: number;
}) {
  const pathname = usePathname();

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
                render={<Link href={APP_ROUTES.DASHBOARD_DOMAINS} />}
              >
                <Globe />
                <span>Domains</span>
              </SidebarMenuButton>
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
