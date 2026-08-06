import type { Metadata } from "next";
import { headers } from "next/headers";

import { Badge } from "@repo/ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { eq } from "drizzle-orm";

import { ConnectStripeButton } from "@/components/dashboard/connect-stripe-button";
import { db } from "@repo/database";
import { stripeAccounts } from "@repo/database/schema";
import { authService } from "@/services/auth-service";

export const metadata: Metadata = {
  title: "Integrations",
};

export default async function IntegrationsPage() {
  const requestHeaders = await headers();
  const session = await authService.getSession(requestHeaders);
  if (!session) {
    return null;
  }
  const [account] = await db
    .select()
    .from(stripeAccounts)
    .where(eq(stripeAccounts.ownerId, session.user.id))
    .limit(1);
  const resendConfigured = Boolean(
    process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Integrations</h1>
        <p className="text-sm text-muted-foreground">
          Connect the services that power your agents.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <CardTitle>Stripe Connect</CardTitle>
              <Badge variant={account?.status === "complete" ? "default" : "secondary"}>
                {account?.status === "complete" ? "Connected" : account?.status ?? "Not connected"}
              </Badge>
            </div>
            <CardDescription>
              Receive payouts for bookings and product payments made through
              your portal links.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {account?.status === "complete" ? (
              <p className="text-sm text-muted-foreground">
                Payouts are enabled on your connected account.
              </p>
            ) : (
              <ConnectStripeButton />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <CardTitle>Email delivery</CardTitle>
              <Badge variant={resendConfigured ? "default" : "secondary"}>
                {resendConfigured ? "Connected" : "Not configured"}
              </Badge>
            </div>
            <CardDescription>
              Campaigns are sent through Resend with delivery and unsubscribe
              tracking.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {resendConfigured
                ? "Resend is ready — create a campaign to start sending."
                : "Set RESEND_API_KEY and RESEND_FROM_EMAIL in your environment to enable sending."}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
