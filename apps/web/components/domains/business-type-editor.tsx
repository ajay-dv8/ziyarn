"use client";

import { useState } from "react";

import {
  getBusinessTypeConfig,
  type BusinessType,
} from "@repo/api/domains/business-types";
import { updateDomainAction, type ActionResult } from "@/lib/actions/domains";

export function BusinessTypeEditor({
  domainId,
  currentType,
}: {
  domainId: string;
  currentType: BusinessType | null;
}) {
  const [value, setValue] = useState<BusinessType | "">(currentType ?? "");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const config = getBusinessTypeConfig(value || null);

  async function handleChange(newValue: BusinessType | "") {
    setSaving(true);
    setFeedback(null);
    const result = (await updateDomainAction(domainId, {
      businessType: newValue || null,
    })) as ActionResult;
    setSaving(false);
    if (result.ok) {
      setValue(newValue);
      setFeedback("Saved");
      setTimeout(() => setFeedback(null), 2000);
    } else {
      setFeedback(result.error);
    }
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Business type</label>
      <select
        value={value}
        onChange={(event) =>
          handleChange(event.target.value as BusinessType | "")
        }
        disabled={saving}
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
      <p className="text-xs text-muted-foreground">
        {config.label} — {config.tagline}
      </p>
      {feedback && (
        <p
          className={`text-xs ${feedback === "Saved" ? "text-green-600" : "text-destructive"}`}
        >
          {feedback}
        </p>
      )}
    </div>
  );
}
