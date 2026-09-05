"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";

import { createDomainAction, type ActionResult } from "@/lib/actions/domains";
import { APP_ROUTES } from "@/constants/routes";
import type { BusinessType } from "@repo/api/domains/business-types";

const BUSINESS_TYPES: BusinessType[] = [
  "education",
  "health",
  "ecommerce",
  "hospitality",
  "food",
  "finance",
];

export function CreateDomainForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Record<string, string[] | undefined>
  >({});

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    setFieldErrors({});

    const formData = new FormData(event.currentTarget);
    const rawBusinessType = String(formData.get("businessType") ?? "");
    const businessType = BUSINESS_TYPES.includes(rawBusinessType as BusinessType)
      ? (rawBusinessType as BusinessType)
      : undefined;
    const result = (await createDomainAction({
      name: String(formData.get("name") ?? ""),
      slug: String(formData.get("slug") ?? ""),
      businessType,
    })) as ActionResult;

    if (!result.ok) {
      setPending(false);
      setError(result.error);
      setFieldErrors(result.fieldErrors ?? {});
      return;
    }

    router.push(APP_ROUTES.DASHBOARD_DOMAINS);
    router.refresh();
  };

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Domain name</Label>
        <Input
          id="name"
          name="name"
          placeholder="Acme Helpdesk"
          aria-invalid={Boolean(fieldErrors.name)}
          aria-describedby={fieldErrors.name ? "name-error" : undefined}
        />
        {fieldErrors.name && (
          <p id="name-error" className="text-sm text-destructive">
            {fieldErrors.name[0]}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="slug">Slug</Label>
        <Input
          id="slug"
          name="slug"
          placeholder="acme-helpdesk"
          aria-invalid={Boolean(fieldErrors.slug)}
          aria-describedby={fieldErrors.slug ? "slug-error" : undefined}
        />
        {fieldErrors.slug && (
          <p id="slug-error" className="text-sm text-destructive">
            {fieldErrors.slug[0]}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="businessType">Business type (optional)</Label>
        <select
          id="businessType"
          name="businessType"
          className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        >
          <option value="">Generic (default)</option>
          <option value="education">Education</option>
          <option value="health">Health & Pharmacy</option>
          <option value="ecommerce">E-Commerce</option>
          <option value="hospitality">Hotels & Hospitality</option>
          <option value="food">Food & Restaurants</option>
          <option value="finance">Banking & Finance</option>
        </select>
      </div>

      {error && !fieldErrors.name && !fieldErrors.slug && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Creating…" : "Create domain"}
      </Button>
    </form>
  );
}
