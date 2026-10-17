import type { Metadata } from "next";
import { headers } from "next/headers";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";

import { AgentActions } from "@/components/dashboard/agent-actions";
import { CreateAgentButton } from "@/components/dashboard/create-agent-button";
import { DomainTabs } from "@/components/domains/domain-tabs";
import { authService } from "@/services/auth-service";
import { agentsService } from "@/services/agents-service";
import { domainsService } from "@/services/domains-service";

export const metadata: Metadata = {
  title: "Agents",
};

export default async function AgentsPage({
  searchParams,
}: {
  searchParams: Promise<{ domainId?: string }>;
}) {
  const requestHeaders = await headers();
  const session = await authService.getSession(requestHeaders);
  if (!session) {
    return null;
  }

  const domains = await domainsService.listDomains(requestHeaders);
  const { domainId } = await searchParams;
  const selected = domains.find((domain) => domain.id === domainId) ?? domains[0];
  const agents = selected
    ? await agentsService.listAgents(selected.id, requestHeaders)
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Agents</h1>
          <p className="text-sm text-muted-foreground">
            Agents chat with your visitors. Filter questions are asked at the
            start of each conversation and saved with the lead.
          </p>
        </div>
        {selected ? (
          <CreateAgentButton
            domains={domains.map((domain) => ({ id: domain.id, name: domain.name }))}
            domainId={selected.id}
            businessType={selected.businessType}
          />
        ) : null}
      </div>

      {/* The sidebar's domain sub-list is the only domain switcher. This inline
          copy was a third one, free to disagree with it. */}
      {selected ? <DomainTabs domainId={selected.id} active="agents" /> : null}

      {!selected ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <p className="text-sm font-medium">No domains yet</p>
            <p className="text-sm text-muted-foreground">
              Create a domain first, then configure its agent.
            </p>
          </CardContent>
        </Card>
      ) : agents.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <p className="text-sm font-medium">No agents yet</p>
            <p className="text-sm text-muted-foreground">
              Create your first agent to answer visitors on the widget.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {agents.map((agent) => {
            const questions = Array.isArray(agent.filterQuestions)
              ? agent.filterQuestions.filter((q): q is string => typeof q === "string")
              : [];
            return (
              <Card key={agent.id}>
                <CardHeader>
                  <CardTitle className="text-base">{agent.name}</CardTitle>
                  <CardDescription>
                    {agent.description ?? "No description"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span className="rounded-md bg-secondary px-2 py-1">
                      {agent.tools?.length ?? 0} tool(s)
                    </span>
                    <span className="rounded-md bg-secondary px-2 py-1">
                      {questions.length} filter question(s)
                    </span>
                  </div>
                  {questions.length > 0 ? (
                    <ul className="space-y-1 text-sm">
                      {questions.map((question, index) => (
                        <li key={index} className="text-muted-foreground">
                          <span className="text-foreground">Q{index + 1}:</span>{" "}
                          {question}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <AgentActions agent={agent} domainId={selected.id} />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}