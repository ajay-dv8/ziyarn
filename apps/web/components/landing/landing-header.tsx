import Link from "next/link";
import { headers } from "next/headers";

import { Button } from "@repo/ui/components/button";

import { APP_ROUTES } from "@/constants/routes";
import { authService } from "@/services/auth-service";

const NAV_LINKS = [
  { label: "Features", href: APP_ROUTES.FEATURES },
  { label: "Pricing", href: APP_ROUTES.PRICING },
  { label: "Docs", href: APP_ROUTES.DOCS },
] as const;

export async function LandingHeader() {
  const session = await authService.getSession(await headers());

  return (
    <header className="flex items-center justify-between border-b px-6 py-4">
      <Link href={APP_ROUTES.HOME} className="text-lg font-semibold tracking-tight">
        Ziyarn
      </Link>
      <nav className="flex items-center gap-3">
        <div className="hidden items-center gap-1 sm:flex">
          {NAV_LINKS.map((link) => (
            <Button
              key={link.href}
              variant="ghost"
              size="sm"
              render={<Link href={link.href} />}
            >
              {link.label}
            </Button>
          ))}
        </div>
        {session ? (
          <Button
            variant="outline"
            size="sm"
            render={<Link href={APP_ROUTES.DASHBOARD} />}
          >
            Dashboard
          </Button>
        ) : (
          <>
            <Button
              variant="ghost"
              size="sm"
              render={<Link href={APP_ROUTES.SIGN_IN} />}
            >
              Sign in
            </Button>
            <Button size="sm" render={<Link href={APP_ROUTES.SIGN_UP} />}>
              Sign up
            </Button>
          </>
        )}
      </nav>
    </header>
  );
}
