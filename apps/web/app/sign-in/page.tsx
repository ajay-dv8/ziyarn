import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";

import { SignInForm } from "@/components/auth/sign-in-form";
import { APP_ROUTES } from "@/constants/routes";
import { authService } from "@/services/auth-service";

export const metadata: Metadata = {
  title: "Sign in",
};

export default async function SignInPage() {
  const session = await authService.getSession(await headers());
  if (session) {
    redirect(APP_ROUTES.DASHBOARD);
  }

  const socialProviders = {
    google: Boolean(process.env.GOOGLE_CLIENT_ID),
    linkedin: Boolean(process.env.LINKEDIN_CLIENT_ID),
  };

  return (
    <main className="flex min-h-svh items-center justify-center px-4 py-12">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>Welcome back to Ziyarn.</CardDescription>
        </CardHeader>
        <CardContent>
          <SignInForm socialProviders={socialProviders} />
        </CardContent>
      </Card>
    </main>
  );
}
