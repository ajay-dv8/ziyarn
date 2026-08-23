import type { Metadata } from "next";
import Link from "next/link";
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
import { DatabaseIntegrationCard } from "@/components/dashboard/database-integration-card";
import { db } from "@repo/database";
import { stripeAccounts } from "@repo/database/schema";
import { authService } from "@/services/auth-service";
import { agentsService } from "@/services/agents-service";
import { domainsService } from "@/services/domains-service";

export const metadata: Metadata = {
  title: "Integrations",
};

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ domainId?: string; agentId?: string }>;
}) {
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
  const smtpConfigured = Boolean(
    process.env.SMTP_HOST && process.env.SMTP_FROM,
  );

  const domains = await domainsService.listDomains(requestHeaders);
  const { domainId, agentId } = await searchParams;
  const selectedDomain =
    domains.find((domain) => domain.id === domainId) ?? domains[0];
  const agents = selectedDomain
    ? await agentsService.listAgents(selectedDomain.id, requestHeaders)
    : [];
  const selectedAgent = agents.find((agent) => agent.id === agentId) ?? agents[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Integrations</h1>
        <p className="text-sm text-muted-foreground">
          Connect the services that power your agents.
        </p>
      </div>

      {domains.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {domains.map((domain) => (
            <Link
              key={domain.id}
              href={`/dashboard/integrations?domainId=${domain.id}`}
              className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                selectedDomain?.id === domain.id
                  ? "border-primary bg-primary/10 font-medium text-primary"
                  : "border-input text-muted-foreground hover:text-foreground"
              }`}
            >
              {domain.name}
            </Link>
          ))}
        </div>
      ) : null}

      {agents.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {agents.map((agent) => (
            <Link
              key={agent.id}
              href={`/dashboard/integrations?domainId=${selectedDomain?.id}&agentId=${agent.id}`}
              className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                selectedAgent?.id === agent.id
                  ? "border-primary bg-primary/10 font-medium text-primary"
                  : "border-input text-muted-foreground hover:text-foreground"
              }`}
            >
              {agent.name}
            </Link>
          ))}
        </div>
      ) : null}

      {!selectedDomain || !selectedAgent ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <p className="text-sm font-medium">No agent configured</p>
            <p className="text-sm text-muted-foreground">
              Create a domain and an agent first — integrations attach to an
              agent.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Databases</CardTitle>
            <CardDescription>
              Give {selectedAgent.name} read access to your own data.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DatabaseIntegrationCard
              domainId={selectedDomain.id}
              agentId={selectedAgent.id}
            />
          </CardContent>
        </Card>
      )}

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
