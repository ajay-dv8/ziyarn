import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { ConversationalOnboarding } from "@/components/onboarding/conversational-onboarding";
import { APP_ROUTES } from "@/constants/routes";
import { authService } from "@/services/auth-service";
import { domainsService } from "@/services/domains-service";

export const metadata: Metadata = {
  title: "Welcome · Set up your workspace",
};

export default async function OnboardingPage() {
  const requestHeaders = await headers();
  const session = await authService.getSession(requestHeaders);
  if (!session) {
    redirect(APP_ROUTES.SIGN_IN);
  }

  // Existing workspaces skip the wizard entirely.
  const domains = await domainsService.listDomains(requestHeaders);
  if (domains.length > 0) {
    redirect(APP_ROUTES.DASHBOARD);
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 px-4 py-8">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Let&apos;s set up your workspace
        </h1>
        <p className="text-sm text-muted-foreground">
          A quick chat to get your AI agent live — takes about a minute.
        </p>
      </div>

      <ConversationalOnboarding userName={session.user.name ?? session.user.email} />

      <p className="text-xs text-muted-foreground">
        Prefer the manual route?{" "}
        <Link
          href={APP_ROUTES.DASHBOARD}
          className="font-medium text-primary hover:underline"
        >
          Skip to dashboard
        </Link>
      </p>
    </main>
  );
}
