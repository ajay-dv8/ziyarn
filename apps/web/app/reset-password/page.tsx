import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";

import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { APP_ROUTES } from "@/constants/routes";

export const metadata: Metadata = {
  title: "Reset password",
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage({
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
            <CardTitle>Reset link missing</CardTitle>
            <CardDescription>
              This password reset link is incomplete. Request a new one to
              continue.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full"
              render={<Link href={APP_ROUTES.FORGOT_PASSWORD} />}
            >
              Request a new link
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-svh items-center justify-center px-4 py-12">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Choose a new password</CardTitle>
          <CardDescription>
            Use at least 8 characters. This link works once and expires in one
            hour.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResetPasswordForm token={token} />
        </CardContent>
      </Card>
    </main>
  );
}
