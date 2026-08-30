import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getPlanLimits, type Plan } from "@repo/api/plans";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@repo/ui/components/sidebar";
import { Separator } from "@repo/ui/components/separator";

import { UserMenu } from "@/components/dashboard/user-menu";
import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { DashboardTitleUpdater } from "@/components/dashboard/dashboard-title-updater";
import { DashboardToastListener } from "@/components/dashboard/dashboard-toast-listener";
import { APP_ROUTES } from "@/constants/routes";
import { authService } from "@/services/auth-service";
import { domainsService } from "@/services/domains-service";

const PLAN_RANK: Record<Plan, number> = {
  free: 0,
  standard: 1,
  pro: 2,
  ultimate: 3,
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await authService.getSession(await headers());
  if (!session) {
    redirect(APP_ROUTES.SIGN_IN);
  }

  const domains = await domainsService.listDomains(await headers());
  const plan = domains.reduce<Plan>(
    (best, domain) =>
      PLAN_RANK[domain.plan] > PLAN_RANK[best] ? domain.plan : best,
    "free",
  );
  const limits = getPlanLimits(plan);

  return (
    <SidebarProvider>
      <DashboardTitleUpdater />
      <DashboardToastListener />
      <AppSidebar
        plan={plan}
        domainCount={domains.length}
        maxDomains={limits.maxDomains}
        domains={domains.map((domain) => ({ id: domain.id, name: domain.name }))}
      />
      <SidebarInset className="h-screen overflow-y-auto">
        <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4" />
          <div className="ml-auto">
            <UserMenu email={session.user.email} />
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
