import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";

import { AcceptInviteButton } from "@/components/team/accept-invite-button";
import { APP_ROUTES } from "@/constants/routes";
import { authService } from "@/services/auth-service";

export const metadata: Metadata = {
  title: "Accept invite",
};

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <main className="flex min-h-svh items-center justify-center px-4 py-12">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Invalid invite</CardTitle>
            <CardDescription>
              This invite link is missing a token. Please ask for a new invite.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  const session = await authService.getSession(await headers());

  if (!session) {
    // Store the invite token in a cookie so we can pick it up after sign-in
    const cookieStore = await cookies();
    cookieStore.set("pending_invite_token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 60 * 60, // 1 hour
      path: "/",
    });
    redirect(APP_ROUTES.SIGN_IN);
  }

  return (
    <main className="flex min-h-svh items-center justify-center px-4 py-12">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Accept invite</CardTitle>
          <CardDescription>
            Click below to join the workspace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AcceptInviteButton token={token} />
        </CardContent>
      </Card>
    </main>
  );
}
