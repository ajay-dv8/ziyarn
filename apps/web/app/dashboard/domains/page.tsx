import type { Metadata } from "next";
import { headers } from "next/headers";

import { PLAN_DISPLAY_NAMES } from "@repo/api/plans";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";

import { CreateDomainButton } from "@/components/domains/create-domain-button";
import { BusinessTypeEditor } from "@/components/domains/business-type-editor";
import { DeleteDomainButton } from "@/components/domains/delete-domain-button";
import { EmbedSnippet } from "@/components/domains/embed-snippet";
import { RenameDomainForm } from "@/components/domains/rename-domain-form";
import { ZyWidget } from "@/components/widget/zy-widget";
import { domainsService } from "@/services/domains-service";

export const metadata: Metadata = {
  title: "Domains",
};

export default async function DomainsPage() {
  const domains = await domainsService.listDomains(await headers());
  const embedConfigs = await Promise.all(
    domains.map(async (domain) =>
      domainsService
        .getEmbedConfig(domain.id, await headers())
        .catch(() => null),
    ),
  );
  const previewDomain = domains[0];
  const preview = previewDomain ? embedConfigs[0] : null;

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold">Domains</h1>
          <p className="text-sm text-muted-foreground">
            Each domain gets its own chatbot agent and embed widget.
          </p>
        </div>

        <CreateDomainButton />
      </div>

      <div className="space-y-4">
        {domains.map((domain, index) => (
          <Card key={domain.id}>
            <CardHeader>
              <CardTitle>{domain.name}</CardTitle>
              <CardDescription>{PLAN_DISPLAY_NAMES[domain.plan]} plan</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <RenameDomainForm
                domainId={domain.id}
                currentName={domain.name}
              />
              <BusinessTypeEditor
                domainId={domain.id}
                currentType={domain.businessType}
              />
              <DeleteDomainButton domainId={domain.id} />
              {embedConfigs[index] && (
                <EmbedSnippet
                  widgetUrl={embedConfigs[index].widgetUrl}
                  slug={embedConfigs[index].slug}
                  secret={embedConfigs[index].secret}
                />
              )}
            </CardContent>
          </Card>
        ))}
        {domains.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No domains yet — click &quot;New domain&quot; to get started.
          </p>
        )}
      </div>

      {preview && previewDomain && (
        <Card>
          <CardHeader>
            <CardTitle>Live preview</CardTitle>
            <CardDescription>
              This is the widget visitors see — try a message with the{" "}
              {previewDomain.name} agent.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ZyWidget
              slug={preview.slug}
              secret={preview.secret}
              title={previewDomain.name}
              subtitle="Preview agent"
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
