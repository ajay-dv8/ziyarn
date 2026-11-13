"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

import {
  DOMAIN_LOCATION_LIMIT,
  isGoogleMapsUrl,
  type DomainLocation,
} from "@repo/api/domains/locations";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";

import {
  parseMapsLinkAction,
  updateDomainAction,
} from "@/lib/actions/domains";

function newLocation(isPrimary: boolean): DomainLocation {
  const random =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return {
    id: `loc_${random.replace(/[^A-Za-z0-9_-]/g, "")}`,
    label: "",
    address: "",
    notes: null,
    latitude: null,
    longitude: null,
    mapsUrl: null,
    placeId: null,
    isPrimary,
  };
}

/**
 * Saved places for the widget's exact map links.
 *
 * The owner only needs a label, an address and a Google Maps link. "Read pin"
 * resolves the link server-side (short share links included) and shows what
 * the widget will use; the raw link is still stored as the fallback.
 */
export function DomainLocationsEditor({
  domainId,
  initialLocations,
}: {
  domainId: string;
  initialLocations: DomainLocation[];
}) {
  const router = useRouter();
  const [locations, setLocations] =
    useState<DomainLocation[]>(initialLocations);
  const [saving, setSaving] = useState(false);
  const [readingId, setReadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  function updateLocation(id: string, patch: Partial<DomainLocation>) {
    setLocations((current) =>
      current.map((location) =>
        location.id === id ? { ...location, ...patch } : location,
      ),
    );
    setError(null);
    setFeedback(null);
  }

  function setPrimary(id: string) {
    setLocations((current) =>
      current.map((location) => ({
        ...location,
        isPrimary: location.id === id,
      })),
    );
    setError(null);
    setFeedback(null);
  }

  function addLocation() {
    if (locations.length >= DOMAIN_LOCATION_LIMIT) return;
    setLocations((current) => [
      ...current,
      newLocation(current.length === 0),
    ]);
    setError(null);
    setFeedback(null);
  }

  function removeLocation(id: string) {
    setLocations((current) => {
      const remaining = current.filter((location) => location.id !== id);
      if (remaining.length === 0) return remaining;
      const [first, ...rest] = remaining;
      if (!first) return remaining;
      return remaining.some((location) => location.isPrimary)
        ? remaining
        : [{ ...first, isPrimary: true }, ...rest];
    });
    setError(null);
    setFeedback(null);
  }

  async function readPin(location: DomainLocation) {
    if (!location.mapsUrl) {
      setError("Paste a Google Maps link first.");
      return;
    }

    setReadingId(location.id);
    setError(null);
    setFeedback(null);
    const result = await parseMapsLinkAction(location.mapsUrl);
    setReadingId(null);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    updateLocation(location.id, {
      latitude: result.latitude,
      longitude: result.longitude,
      placeId: result.placeId,
      mapsUrl: result.mapsUrl,
    });

    setFeedback(
      result.latitude !== null || result.placeId
        ? "Exact pin found. Save to publish it."
        : "No pin data found. The link will still be used; check that it opens the exact place.",
    );
  }

  async function save() {
    for (const [index, location] of locations.entries()) {
      if (!location.label.trim()) {
        setError(`Location ${index + 1}: add a short name.`);
        return;
      }
      if (!location.address.trim()) {
        setError(`Location ${index + 1}: add the address visitors should tap.`);
        return;
      }
      if (location.mapsUrl && !isGoogleMapsUrl(location.mapsUrl)) {
        setError(`Location ${index + 1}: use a Google Maps link.`);
        return;
      }
      const hasCoordinates =
        typeof location.latitude === "number" &&
        typeof location.longitude === "number";
      if (!location.mapsUrl && !location.placeId && !hasCoordinates) {
        setError(
          `Location ${index + 1}: add a Google Maps link so directions point to the exact place.`,
        );
        return;
      }
    }

    const primaryIndex = locations.findIndex((location) => location.isPrimary);
    const resolvedPrimary = primaryIndex === -1 ? 0 : primaryIndex;
    const normalized = locations.map((location, index) => ({
      ...location,
      isPrimary: index === resolvedPrimary,
    }));

    setSaving(true);
    setError(null);
    setFeedback(null);
    const result = await updateDomainAction(domainId, {
      locations: normalized,
    });
    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setLocations(normalized);
    setFeedback("Saved");
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {locations.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No saved locations yet. Add one so visitors can tap the address for
          exact directions.
        </p>
      ) : null}

      {locations.map((location, index) => {
        const title = location.label.trim() || `Location ${index + 1}`;
        const pinReady =
          (typeof location.latitude === "number" &&
            typeof location.longitude === "number") ||
          Boolean(location.placeId);

        return (
          <div
            key={location.id}
            className="space-y-3 rounded-lg border bg-muted/20 p-3"
          >
            <div className="flex items-start justify-between gap-3">
              <label className="flex items-center gap-2 text-xs font-medium">
                <input
                  type="radio"
                  name={`primary-location-${domainId}`}
                  checked={location.isPrimary}
                  onChange={() => setPrimary(location.id)}
                />
                Primary location
              </label>
              <button
                type="button"
                onClick={() => removeLocation(location.id)}
                disabled={saving}
                className="text-xs text-destructive underline-offset-2 hover:underline"
              >
                Remove
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`${location.id}-label`}>Short name</Label>
                <Input
                  id={`${location.id}-label`}
                  value={location.label}
                  onChange={(event) =>
                    updateLocation(location.id, { label: event.target.value })
                  }
                  placeholder="Osu branch"
                  maxLength={80}
                  disabled={saving}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${location.id}-address`}>
                  Address visitors tap
                </Label>
                <Input
                  id={`${location.id}-address`}
                  value={location.address}
                  onChange={(event) =>
                    updateLocation(location.id, { address: event.target.value })
                  }
                  placeholder="12 Oxford Street, Osu, Accra"
                  maxLength={300}
                  disabled={saving}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`${location.id}-notes`}>Notes (optional)</Label>
              <textarea
                id={`${location.id}-notes`}
                value={location.notes ?? ""}
                onChange={(event) =>
                  updateLocation(location.id, {
                    notes: event.target.value || null,
                  })
                }
                placeholder="Parking, opening hours, which entrance to use"
                maxLength={500}
                rows={2}
                disabled={saving}
                className="w-full rounded-lg border border-input bg-background px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`${location.id}-maps`}>
                Google Maps link
              </Label>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  id={`${location.id}-maps`}
                  value={location.mapsUrl ?? ""}
                  onChange={(event) => {
                    const value = event.target.value.trim();
                    updateLocation(location.id, {
                      mapsUrl: value || null,
                      latitude: null,
                      longitude: null,
                      placeId: null,
                    });
                  }}
                  placeholder="https://maps.app.goo.gl/..."
                  maxLength={1_000}
                  disabled={saving || readingId === location.id}
                  className="min-w-0 flex-1"
                  autoComplete="off"
                  spellCheck={false}
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void readPin(location)}
                  disabled={
                    saving ||
                    readingId === location.id ||
                    !location.mapsUrl
                  }
                >
                  {readingId === location.id ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    "Read pin"
                  )}
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {pinReady ? (
                  <span className="text-emerald-700">
                    Exact pin ready
                    {typeof location.latitude === "number" &&
                    typeof location.longitude === "number"
                      ? ` (${location.latitude}, ${location.longitude})`
                      : ""}
                  </span>
                ) : location.mapsUrl ? (
                  <span>
                    No pin detected. The link will still open; check that it
                    points to the exact place.
                  </span>
                ) : (
                  <span>Paste a Google Maps place link to set the pin.</span>
                )}
                {location.mapsUrl && isGoogleMapsUrl(location.mapsUrl) ? (
                  <a
                    href={location.mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium underline underline-offset-2"
                  >
                    Open link
                  </a>
                ) : null}
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              The agent uses {title} when customers ask where you are.
            </p>
          </div>
        );
      })}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={addLocation}
          disabled={saving || locations.length >= DOMAIN_LOCATION_LIMIT}
        >
          Add location
        </Button>
        <Button type="button" onClick={() => void save()} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Saving…
            </>
          ) : (
            "Save locations"
          )}
        </Button>
        {locations.length >= DOMAIN_LOCATION_LIMIT ? (
          <span className="text-xs text-muted-foreground">
            Maximum {DOMAIN_LOCATION_LIMIT} locations.
          </span>
        ) : null}
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {feedback ? (
        <p className="text-sm text-muted-foreground" role="status">
          {feedback}
        </p>
      ) : null}
    </div>
  );
}
