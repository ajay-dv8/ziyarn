import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { LogoutButton } from "@/components/auth/logout-button";
import { APP_ROUTES } from "@/constants/routes";
import { authService } from "@/lib/auth-service";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await authService.getSession(await headers());
  if (!session) {
    redirect(APP_ROUTES.SIGN_IN);
  }

  return (
    <div className="min-h-svh">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <nav className="flex items-center gap-6">
            <Link href={APP_ROUTES.HOME} className="font-semibold">
              Ziyarn
            </Link>
            <Link
              href={APP_ROUTES.DASHBOARD_DOMAINS}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Domains
            </Link>
          </nav>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {session.user.email}
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
