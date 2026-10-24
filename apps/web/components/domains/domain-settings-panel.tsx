import { PLAN_DISPLAY_NAMES } from "@repo/api/plans";
import type { BusinessType } from "@repo/api/domains/business-types";
import type { WidgetVariantId } from "@repo/api/domains/widget-variants";

import { BusinessTypeEditor } from "@/components/domains/business-type-editor";
import { CopySecretField } from "@/components/domains/copy-secret-field";
import { DomainLogoEditor } from "@/components/domains/domain-logo-editor";
import { RenameDomainForm } from "@/components/domains/rename-domain-form";
import { SlugEditor } from "@/components/domains/slug-editor";
import { WidgetVariantPicker } from "@/components/domains/widget-variant-picker";

/**
 * Everything about a domain that an owner can change, on one page.
 *
 * These controls existed, but they lived in a kebab-menu dialog on the domain
 * card — a poor home for anything you might need to change, and especially for
 * the embed secret, which you may need to rotate or copy at any time.
 *
 * Ordered by what you are likely to want to change: the editable fields first,
 * top to bottom, then the read-only facts about the domain underneath. Plan is
 * read-only because it is the billing system; the slug is editable because
 * owners occasionally need to correct it, with a note about refreshing the
 * snippet on their site.
 */
export function DomainSettingsPanel({
  domainId,
  domainName,
  slug,
  logoUrl,
  plan,
  businessType,
  widgetVariant,
  embedSecret,
}: {
  domainId: string;
  domainName: string;
  slug: string;
  logoUrl: string | null;
  plan: keyof typeof PLAN_DISPLAY_NAMES;
  businessType: BusinessType | null;
  widgetVariant: WidgetVariantId;
  embedSecret: string | null;
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border p-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Logo
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Shown on this domain&apos;s dashboard card and in its chat widget.
        </p>
        <div className="mt-3">
          <DomainLogoEditor
            domainId={domainId}
            domainName={domainName}
            currentLogoUrl={logoUrl}
          />
        </div>
      </div>

      <div className="rounded-lg border p-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Name
        </p>
        <div className="mt-3">
          <RenameDomainForm
            domainId={domainId}
            currentName={domainName}
            id={`domain-settings-name-${domainId}`}
          />
        </div>
      </div>

      <div className="rounded-lg border p-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Business type
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Decides which pages and labels this domain uses.
        </p>
        <div className="mt-3">
          <BusinessTypeEditor
            domainId={domainId}
            currentType={businessType}
          />
        </div>
      </div>

      <div className="rounded-lg border p-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Widget
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Which widget visitors see on this domain.
        </p>
        <div className="mt-3">
          <WidgetVariantPicker
            domainId={domainId}
            currentVariant={widgetVariant}
            plan={plan}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Slug
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Used in the embed snippet and the sleek iframe URL. Live installs
            keep working, but update the snippet on your site after changing it.
          </p>
          <div className="mt-3">
            <SlugEditor
              domainId={domainId}
              currentSlug={slug}
              id={`domain-settings-slug-${domainId}`}
            />
          </div>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Plan
          </p>
          <p className="mt-1 text-sm">
            {PLAN_DISPLAY_NAMES[plan] ?? plan} plan
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Set on your account, not per domain.
          </p>
        </div>
      </div>

      <div className="rounded-lg border p-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Embed secret
        </p>
        {embedSecret ? (
          <>
            <CopySecretField value={embedSecret} label="Embed secret" />
            <p className="mt-2 text-xs text-muted-foreground">
              Identifies this domain to the chat API. Anyone with the secret
              can post to this agent, so treat it like a password.
            </p>
          </>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">
            Could not be loaded.
          </p>
        )}
      </div>
    </div>
  );
}
