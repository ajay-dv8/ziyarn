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
import { DomainCardMenu } from "@/components/domains/domain-card-menu";
import { EmbedSnippet } from "@/components/domains/embed-snippet";
import { WidgetPreviewSwitcher } from "@/components/domains/widget-preview-switcher";
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
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
              <div className="min-w-0 space-y-1.5">
                <CardTitle className="truncate">{domain.name}</CardTitle>
                <CardDescription>
                  {PLAN_DISPLAY_NAMES[domain.plan]} plan · {domain.slug}
                </CardDescription>
              </div>

              <DomainCardMenu
                domainId={domain.id}
                domainName={domain.name}
                businessType={domain.businessType}
                widgetVariant={domain.widgetVariant}
              />
            </CardHeader>
            <CardContent className="space-y-4">
              {embedConfigs[index] && (
                <EmbedSnippet
                  widgetUrl={embedConfigs[index].widgetUrl}
                  slug={embedConfigs[index].slug}
                  secret={embedConfigs[index].secret}
                  variant={embedConfigs[index].variant}
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
        <WidgetPreviewSwitcher
          slug={preview.slug}
          secret={preview.secret}
          domainName={previewDomain.name}
          savedVariant={preview.variant}
        />
      )}
    </div>
  );
}
