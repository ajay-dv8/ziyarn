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

import { AcceptTeamInviteButton } from "@/components/team/accept-team-invite-button";
import { APP_ROUTES } from "@/constants/routes";
import { authService } from "@/services/auth-service";

export const metadata: Metadata = {
  title: "Accept team invite",
};

export default async function AcceptTeamInvitePage({
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
    const cookieStore = await cookies();
    cookieStore.set("pending_team_invite_token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 60 * 60,
      path: "/",
    });
    redirect(APP_ROUTES.SIGN_IN);
  }

  return (
    <main className="flex min-h-svh items-center justify-center px-4 py-12">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Accept team invite</CardTitle>
          <CardDescription>Click below to join the team.</CardDescription>
        </CardHeader>
        <CardContent>
          <AcceptTeamInviteButton token={token} />
        </CardContent>
      </Card>
    </main>
  );
}
