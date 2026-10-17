import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

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
import { DomainTabs } from "@/components/domains/domain-tabs";
import { EmbedSnippet } from "@/components/domains/embed-snippet";
import { WidgetPreviewSwitcher } from "@/components/domains/widget-preview-switcher";
import { APP_ROUTES } from "@/constants/routes";
import { domainsService } from "@/services/domains-service";

export const metadata: Metadata = {
  title: "Domains",
};

export default async function DomainsPage({
  searchParams,
}: {
  searchParams: Promise<{ domainId?: string }>;
}) {
  const requestHeaders = await headers();
  const domains = await domainsService.listDomains(requestHeaders);
  const { domainId } = await searchParams;

  // With ?domainId= this page is that one domain's Overview tab; without it, it
  // is the list. One route, one convention — the same way the agents and
  // knowledge pages already resolve a domain.
  if (domainId) {
    const domain = domains.find((entry) => entry.id === domainId);
    if (!domain) {
      // A stale link to a domain that has since been deleted. Send them
      // somewhere real rather than rendering an empty shell.
      redirect(APP_ROUTES.DASHBOARD_DOMAINS);
    }
    const embedConfig = await domainsService
      .getEmbedConfig(domain.id, requestHeaders)
      .catch(() => null);

    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight">
              {domain.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              {PLAN_DISPLAY_NAMES[domain.plan]} plan · {domain.slug}
            </p>
          </div>

          <DomainCardMenu
            domainId={domain.id}
            domainName={domain.name}
            businessType={domain.businessType}
            widgetVariant={domain.widgetVariant}
          />
        </div>

        <DomainTabs domainId={domain.id} active="overview" />

        {embedConfig ? (
          <Card>
            <CardHeader>
              <CardTitle>Install on {domain.name}</CardTitle>
              <CardDescription>
                Paste this before the closing &lt;/body&gt; tag.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EmbedSnippet
                widgetUrl={embedConfig.widgetUrl}
                slug={embedConfig.slug}
                secret={embedConfig.secret}
                variant={embedConfig.variant}
              />
            </CardContent>
          </Card>
        ) : null}

        {embedConfig ? (
          <WidgetPreviewSwitcher
            slug={embedConfig.slug}
            secret={embedConfig.secret}
            domainName={domain.name}
            savedVariant={embedConfig.variant}
          />
        ) : null}
      </div>
    );
  }

  const embedConfigs = await Promise.all(
    domains.map((domain) =>
      domainsService
        .getEmbedConfig(domain.id, requestHeaders)
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
            Each domain gets its own agent, knowledge base and embed widget.
          </p>
        </div>

        <CreateDomainButton />
      </div>

      <div className="space-y-4">
        {domains.map((domain, index) => (
          <Card key={domain.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
              <div className="min-w-0 space-y-1.5">
                {/* The way into a domain's tabs. Without this the list is a
                    dead end: the only route in would be the sidebar. */}
                <CardTitle className="truncate">
                  <Link
                    href={`${APP_ROUTES.DASHBOARD_DOMAINS}?domainId=${domain.id}`}
                    className="hover:underline underline-offset-4"
                  >
                    {domain.name}
                  </Link>
                </CardTitle>
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
