import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";

import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";

import { VerifyEmailForm } from "@/components/auth/verify-email-form";
import { APP_ROUTES } from "@/constants/routes";
import { authService } from "@/services/auth-service";

export const metadata: Metadata = {
  title: "Verify email",
  robots: { index: false, follow: false },
};

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";

  if (!token) {
    return (
      <main className="flex min-h-svh items-center justify-center px-4 py-12">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Verification link missing</CardTitle>
            <CardDescription>
              This verification link is incomplete. Sign in and request a new
              email from the dashboard banner.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full"
              render={<Link href={APP_ROUTES.SIGN_IN} />}
            >
              Sign in
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  // Read the session only to keep the copy honest; verification is performed
  // on the client so an email scanner cannot consume the token by fetching it.
  const session = await authService.getSession(await headers());

  return (
    <main className="flex min-h-svh items-center justify-center px-4 py-12">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Verify your email</CardTitle>
          <CardDescription>
            {session?.user.email
              ? `Confirm that ${session.user.email} belongs to you.`
              : "Confirm your email address to finish setting up your account."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <VerifyEmailForm token={token} />
        </CardContent>
      </Card>
    </main>
  );
}
