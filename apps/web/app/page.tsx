import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Button } from "@repo/ui/components/button";

import { LandingHeader } from "@/components/landing/landing-header";
import { APP_ROUTES } from "@/constants/routes";
import { authService } from "@/services/auth-service";

export default async function HomePage() {
  const session = await authService.getSession(await headers());
  if (session) {
    redirect(APP_ROUTES.DASHBOARD);
  }

  return (
    <div className="flex min-h-svh flex-col">
      <LandingHeader />

      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
          AI agents for helpdesk and sales
        </h1>
        <p className="max-w-xl text-muted-foreground">
          Ziyarn embeds intelligent agents into your app or website to answer questions,
          qualify leads, and resolve tickets around the clock.
        </p>
        <Button size="lg" className="mt-2" render={<Link href={APP_ROUTES.SIGN_UP} />}>
          Get started
        </Button>
      </main>
    </div>
  );
}
