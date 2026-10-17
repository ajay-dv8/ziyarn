import type { Metadata } from "next";
import { headers } from "next/headers";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";

import { DatabaseIntegrationCard } from "@/components/dashboard/database-integration-card";
import { AgentPicker } from "@/components/domains/agent-picker";
import { DomainTabs } from "@/components/domains/domain-tabs";
import { agentsService } from "@/services/agents-service";
import { authService } from "@/services/auth-service";
import { domainsService } from "@/services/domains-service";

export const metadata: Metadata = {
  title: "Databases",
};

/**
 * Database connections for a domain's agents.
 *
 * These attach to an AGENT (data_sources.agentId), not to a domain, so the
 * page is shaped like Knowledge: the domain comes from the tab bar, the agent
 * from a picker beneath it.
 *
 * This is the domain-scoped half of what used to be the Integrations page.
 * Stripe Connect and email delivery are account-level — one Stripe account
 * per user, one SMTP server for the whole deployment — so they stayed there
 * and lost their domain switcher entirely.
 */
export default async function DatabasesPage({
  searchParams,
}: {
  searchParams: Promise<{ domainId?: string; agentId?: string }>;
}) {
  const requestHeaders = await headers();
  const session = await authService.getSession(requestHeaders);
  if (!session) {
    return null;
  }

  const domains = await domainsService.listDomains(requestHeaders);
  const { domainId, agentId } = await searchParams;
  const selectedDomain =
    domains.find((domain) => domain.id === domainId) ?? domains[0];
  const agents = selectedDomain
    ? await agentsService.listAgents(selectedDomain.id, requestHeaders)
    : [];
  const selectedAgent =
    agents.find((agent) => agent.id === agentId) ?? agents[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Databases</h1>
        <p className="text-sm text-muted-foreground">
          Connect your own database and let an agent answer from live data.
        </p>
      </div>

      {selectedDomain ? (
        <DomainTabs
          domainId={selectedDomain.id}
          active="databases"
          agentId={selectedAgent?.id}
        />
      ) : null}

      {selectedDomain ? (
        <AgentPicker
          domainId={selectedDomain.id}
          agents={agents}
          activeAgentId={selectedAgent?.id}
          path="/dashboard/databases"
        />
      ) : null}

      {!selectedDomain || !selectedAgent ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <p className="text-sm font-medium">No agent configured</p>
            <p className="text-sm text-muted-foreground">
              Create a domain and an agent first — database connections attach
              to an agent.
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
    </div>
  );
}
