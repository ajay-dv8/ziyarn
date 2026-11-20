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
import { canManageWorkspace } from "@repo/api/workspaces/roles";
import { db } from "@repo/database";
import { stripeAccounts } from "@repo/database/schema";
import { authService } from "@/services/auth-service";
import { workspaceService } from "@/services/workspace-service";

export const metadata: Metadata = {
  title: "Integrations",
};

export default async function IntegrationsPage() {
  const requestHeaders = await headers();
  const session = await authService.getSession(requestHeaders);
  if (!session) {
    return null;
  }
  const workspaceId =
    await workspaceService.getActiveWorkspaceId(requestHeaders);
  const workspace = workspaceId
    ? await workspaceService.getWorkspace(workspaceId, requestHeaders)
    : null;
  const [account] = workspaceId
    ? await db
        .select()
        .from(stripeAccounts)
        .where(eq(stripeAccounts.workspaceId, workspaceId))
        .limit(1)
    : [];
  const canManageStripe = workspace
    ? canManageWorkspace(workspace.role)
    : false;
  const smtpConfigured = Boolean(
    process.env.SMTP_HOST && process.env.SMTP_FROM,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Integrations</h1>
        <p className="text-sm text-muted-foreground">
          Connect the services that run your workspace. These connections are
          shared by everyone in it.
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
            ) : !workspace ? (
              <p className="text-sm text-muted-foreground">
                Create a workspace to connect a Stripe account.
              </p>
            ) : canManageStripe ? (
              <ConnectStripeButton />
            ) : (
              <p className="text-sm text-muted-foreground">
                Ask a workspace owner or admin to connect Stripe.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <CardTitle>Email delivery</CardTitle>
              <Badge variant={smtpConfigured ? "default" : "secondary"}>
                {smtpConfigured ? "Connected" : "Not configured"}
              </Badge>
            </div>
            <CardDescription>
              Campaigns are sent through Resend with delivery and unsubscribe
              tracking.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {smtpConfigured
                ? "SMTP is ready — create a campaign to start sending."
                : "Set SMTP_HOST and SMTP_FROM in your environment to enable sending."}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
