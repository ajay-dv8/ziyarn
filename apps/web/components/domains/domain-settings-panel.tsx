import { PLAN_DISPLAY_NAMES } from "@repo/api/plans";
import type { BusinessType } from "@repo/api/domains/business-types";
import type { WidgetVariantId } from "@repo/api/domains/widget-variants";

import { BusinessTypeEditor } from "@/components/domains/business-type-editor";
import { RenameDomainForm } from "@/components/domains/rename-domain-form";
import { WidgetVariantPicker } from "@/components/domains/widget-variant-picker";

/**
 * Everything about a domain that an owner can change, on one page.
 *
 * These controls existed, but they lived in a kebab-menu dialog on the domain
 * card — a poor home for anything you might need to change, and especially for
 * the embed secret, which you may need to rotate or copy at any time.
 *
 * Deliberately read-only for anything the platform owns: the slug and the plan
 * are shown, not edited, because changing them has consequences outside this
 * screen (the slug is in every live embed snippet, and the plan is the billing
 * system). They are visible so nobody goes looking for them.
 */
export function DomainSettingsPanel({
  domainId,
  domainName,
  slug,
  plan,
  businessType,
  widgetVariant,
  embedSecret,
}: {
  domainId: string;
  domainName: string;
  slug: string;
  plan: keyof typeof PLAN_DISPLAY_NAMES;
  businessType: BusinessType | null;
  widgetVariant: WidgetVariantId;
  embedSecret: string | null;
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Slug
          </p>
          <p className="mt-1 font-mono text-sm break-all">{slug}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Used in the embed snippet. Changing it would break every live
            install.
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Plan
          </p>
          <p className="mt-1 text-sm">
            {PLAN_DISPLAY_NAMES[plan] ?? plan} plan
          </p>          <p className="mt-2 text-xs text-muted-foreground">
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
            <p className="mt-1 font-mono text-sm break-all">{embedSecret}</p>
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

      <div className="rounded-lg border p-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Name
        </p>
        <div className="mt-2">
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
          />
        </div>
      </div>
    </div>
  );
}
