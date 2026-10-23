"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";

import { Button } from "@repo/ui/components/button";

import { API_ROUTES } from "@/constants/routes";
import { updateDomainAction } from "@/lib/actions/domains";

import { DomainLogo } from "./domain-logo";

const MAX_BYTES = 2 * 1024 * 1024;

const ACCEPTED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
]);

export function DomainLogoEditor({
  domainId,
  domainName,
  currentLogoUrl,
}: {
  domainId: string;
  domainName: string;
  currentLogoUrl: string | null;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(currentLogoUrl);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function persistLogo(nextLogoUrl: string | null): Promise<boolean> {
    const result = await updateDomainAction(domainId, { logoUrl: nextLogoUrl });
    if (!result.ok) {
      setError(result.error);
      return false;
    }

    setLogoUrl(nextLogoUrl);
    router.refresh();
    return true;
  }

  async function handleFile(file: File) {
    if (!ACCEPTED_TYPES.has(file.type)) {
      setError("Logo must be a PNG, JPG, WebP or SVG file.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Logo must be 2 MB or smaller.");
      return;
    }

    setPending(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(API_ROUTES.uploads.logo, {
        method: "POST",
        body: formData,
      });
      const body = (await response.json().catch(() => null)) as {
        url?: string;
        error?: { message?: string };
      } | null;
      if (!response.ok || !body?.url) {
        throw new Error(body?.error?.message ?? "Upload failed");
      }

      await persistLogo(body.url);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Could not upload that logo.",
      );
    } finally {
      setPending(false);
    }
  }

  async function handleRemove() {
    setPending(true);
    setError(null);
    try {
      await persistLogo(null);
    } catch {
      setError("Could not remove that logo. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-4">
        <DomainLogo name={domainName} logoUrl={logoUrl} size="lg" />
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => fileInputRef.current?.click()}
            >
              {pending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <ImagePlus className="size-3.5" />
              )}
              {logoUrl ? "Replace logo" : "Upload logo"}
            </Button>
            {logoUrl ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => void handleRemove()}
              >
                <Trash2 className="size-3.5" />
                Remove
              </Button>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            PNG, JPG, WebP or SVG, up to 2 MB.
          </p>
        </div>
      </div>

      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        aria-label="Upload domain logo"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void handleFile(file);
        }}
      />
    </div>
  );
}
