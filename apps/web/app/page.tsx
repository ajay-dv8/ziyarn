import Link from "next/link";
import { headers } from "next/headers";

import { Button } from "@repo/ui/components/button";

import { LogoutButton } from "@/components/auth/logout-button";
import { authService } from "@/lib/auth-service";

export default async function HomePage() {
  const session = await authService.getSession(await headers());

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <span className="text-lg font-semibold tracking-tight">Ziyarn</span>
        <nav className="flex items-center gap-3">
          {session ? (
            <>
              <span className="text-sm text-muted-foreground">
                Signed in as <span className="font-medium text-foreground">{session.user.email}</span>
              </span>
              <LogoutButton />
            </>
          ) : (
            <>
              <Button variant="ghost" render={<Link href="/sign-in" />}>
                Sign in
              </Button>
              <Button render={<Link href="/sign-up" />}>Sign up</Button>
            </>
          )}
        </nav>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
          AI agents for helpdesk and sales
        </h1>
        <p className="max-w-xl text-muted-foreground">
          Ziyarn embeds intelligent agents into your app or website to answer questions,
          qualify leads, and resolve tickets around the clock.
        </p>
        {!session && (
          <Button size="lg" className="mt-2" render={<Link href="/sign-up" />}>
            Get started
          </Button>
        )}
      </main>
    </div>
  );
}
