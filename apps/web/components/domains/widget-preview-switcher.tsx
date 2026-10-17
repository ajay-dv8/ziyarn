"use client";

import { useState } from "react";

import { WIDGET_VARIANTS, type WidgetVariantId } from "@repo/api/domains";
import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";

import { ZyWidget } from "@/components/widget/zy-widget";

/**
 * Live preview with a widget switcher.
 *
 * Two deliberate rules, so the preview can never mislead:
 *
 *  1. Switching is LOCAL state only — it never writes to the domain.
 *  2. When the previewed variant differs from the saved one, say so. An owner
 *     who believes they changed the widget when they did not is worse off than
 *     one with no preview at all.
 *
 * Each switch mounts a real <zy-widget>. The engine guards double-init per
 * element, and the localStorage keys are namespaced per domain slug, so two
 * variants side by side stay isolated.
 */
export function WidgetPreviewSwitcher({
  slug,
  secret,
  domainName,
  savedVariant,
}: {
  slug: string;
  secret: string;
  domainName: string;
  savedVariant: WidgetVariantId;
}) {
  const [previewing, setPreviewing] = useState<WidgetVariantId>(savedVariant);

  const isUnsaved = previewing !== savedVariant;
  const previewingLabel =
    WIDGET_VARIANTS.find((variant) => variant.id === previewing)?.label ??
    previewing;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Live preview</CardTitle>
        <CardDescription>
          This is what visitors see with the {domainName} agent. Try a message,
          or switch widget to preview the others.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          role="group"
          aria-label="Preview widget style"
          className="flex flex-wrap gap-2"
        >
          {WIDGET_VARIANTS.map((variant) => {
            const isActive = variant.id === previewing;
            return (
              <Button
                key={variant.id}
                variant={isActive ? "default" : "outline"}
                size="sm"
                aria-pressed={isActive}
                onClick={() => setPreviewing(variant.id)}
              >
                {variant.label}
              </Button>
            );
          })}
        </div>

        {isUnsaved ? (
          <p
            className="text-sm text-amber-600"
            role="status"
          >
            Previewing {previewingLabel}. Your site still uses{" "}
            {WIDGET_VARIANTS.find((variant) => variant.id === savedVariant)
              ?.label ?? savedVariant}{" "}
            until you save it in the domain&apos;s Edit dialog.
          </p>
        ) : null}

        <ZyWidget
          key={`${previewing}-${slug}`}
          slug={slug}
          secret={secret}
          title={domainName}
          subtitle="Preview agent"
          variant={previewing}
        />
      </CardContent>
    </Card>
  );
}