"use client";

import { useRef, useState } from "react";
import { ChevronDown, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

import {
  DOMAIN_LOCATION_LIMIT,
  LOCATION_TYPE_OPTIONS,
  isGoogleMapsUrl,
  locationDirectionsUrl,
  locationTypeLabel,
  resolveLocationType,
  type DomainLocation,
  type LocationType,
} from "@repo/api/domains/locations";
import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { Checkbox } from "@repo/ui/components/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";

import { parseMapsLinkAction, updateDomainAction } from "@/lib/actions/domains";

function newLocation(isPrimary: boolean): DomainLocation {
  const random =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return {
    id: `loc_${random.replace(/[^A-Za-z0-9_-]/g, "")}`,
    label: "",
    locationType: isPrimary ? "head_office" : "branch",
    address: "",
    notes: null,
    latitude: null,
    longitude: null,
    mapsUrl: null,
    placeId: null,
    isPrimary,
  };
}

function normalizeLocations(
  nextLocations: DomainLocation[],
  preferredPrimaryId?: string,
): DomainLocation[] {
  const primaryId =
    (preferredPrimaryId &&
    nextLocations.some((location) => location.id === preferredPrimaryId)
      ? preferredPrimaryId
      : nextLocations.find((location) => location.isPrimary)?.id) ??
    nextLocations[0]?.id;

  return nextLocations.map((location) => {
    const isPrimary = location.id === primaryId;
    return {
      ...location,
      locationType:
        location.locationType ?? (isPrimary ? "head_office" : "branch"),
      isPrimary,
    };
  });
}

function validateLocation(location: DomainLocation): string | null {
  if (!location.label.trim()) return "Add a short name.";
  if (!location.address.trim()) return "Add the address visitors should tap.";
  if (location.mapsUrl && !isGoogleMapsUrl(location.mapsUrl)) {
    return "Use a Google Maps link.";
  }

  const hasCoordinates =
    typeof location.latitude === "number" &&
    typeof location.longitude === "number";
  if (!location.mapsUrl && !location.placeId && !hasCoordinates) {
    return "Add a Google Maps link so directions point to the exact place.";
  }

  return null;
}

/**
 * Saved places for the widget's exact map links.
 *
 * The list and the form are separate: adding or editing opens one dialog and
 * saves straight away, so the list underneath is always the published state.
 * The card header variant is used on the Knowledge page; the plain variant
 * stays usable inside the domain settings panel.
 */
export function DomainLocationsEditor({
  domainId,
  initialLocations,
  showHeader = false,
}: {
  domainId: string;
  initialLocations: DomainLocation[];
  /** Render the Knowledge-page collapsible card with its desktop add action. */
  showHeader?: boolean;
}) {
  const router = useRouter();
  const readRequestId = useRef(0);
  const [expanded, setExpanded] = useState(false);
  const [locations, setLocations] =
    useState<DomainLocation[]>(initialLocations);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<DomainLocation | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [readingPin, setReadingPin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pinFeedback, setPinFeedback] = useState<string | null>(null);

  const limitReached = locations.length >= DOMAIN_LOCATION_LIMIT;
  const isNewLocation = editingLocation
    ? !locations.some((location) => location.id === editingLocation.id)
    : true;

  function openAdd() {
    if (limitReached) return;
    setEditingLocation(newLocation(locations.length === 0));
    setFormError(null);
    setPinFeedback(null);
    setError(null);
    setFeedback(null);
    setDialogOpen(true);
  }

  function openEdit(location: DomainLocation) {
    setEditingLocation({
      ...location,
      locationType: resolveLocationType(location),
    });
    setFormError(null);
    setPinFeedback(null);
    setError(null);
    setFeedback(null);
    setDialogOpen(true);
  }

  function updateEditing(patch: Partial<DomainLocation>) {
    setEditingLocation((current) =>
      current ? { ...current, ...patch } : current,
    );
    setFormError(null);
  }

  function handleDialogOpenChange(open: boolean) {
    if (saving) return;
    if (!open) {
      // Ignore a pin read that lands after this dialog has closed.
      readRequestId.current += 1;
      setReadingPin(false);
      setEditingLocation(null);
      setFormError(null);
      setPinFeedback(null);
    }
    setDialogOpen(open);
  }

  async function readPin() {
    if (!editingLocation) return;
    if (!editingLocation.mapsUrl) {
      setFormError("Paste a Google Maps link first.");
      return;
    }

    const requestId = readRequestId.current + 1;
    readRequestId.current = requestId;
    setReadingPin(true);
    setFormError(null);
    setPinFeedback(null);
    let result;
    try {
      result = await parseMapsLinkAction(editingLocation.mapsUrl);
    } catch {
      if (requestId !== readRequestId.current) return;
      setReadingPin(false);
      setFormError("Could not read the map link. Please try again.");
      return;
    }
    if (requestId !== readRequestId.current) return;
    setReadingPin(false);

    if (!result.ok) {
      setFormError(result.error);
      return;
    }

    setEditingLocation((current) =>
      current
        ? {
            ...current,
            latitude: result.latitude,
            longitude: result.longitude,
            placeId: result.placeId,
            mapsUrl: result.mapsUrl,
          }
        : current,
    );
    setPinFeedback(
      result.latitude !== null || result.placeId
        ? "Exact pin found. Save to publish it."
        : "No pin data found. The link will still be used; check that it opens the exact place.",
    );
  }

  async function saveLocation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingLocation) return;

    const candidate: DomainLocation = {
      ...editingLocation,
      label: editingLocation.label.trim(),
      address: editingLocation.address.trim(),
      notes: editingLocation.notes?.trim() || null,
      locationType: resolveLocationType(editingLocation),
    };
    const validationError = validateLocation(candidate);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    const nextLocations = locations.some(
      (location) => location.id === candidate.id,
    )
      ? locations.map((location) =>
          location.id === candidate.id ? candidate : location,
        )
      : [...locations, candidate];
    const otherPrimaryId = locations.find(
      (location) => location.isPrimary && location.id !== candidate.id,
    )?.id;
    const preferredPrimaryId = candidate.isPrimary
      ? candidate.id
      : (otherPrimaryId ?? nextLocations[0]?.id);
    const normalized = normalizeLocations(nextLocations, preferredPrimaryId);

    setSaving(true);
    setFormError(null);
    let result;
    try {
      result = await updateDomainAction(domainId, { locations: normalized });
    } catch {
      setSaving(false);
      setFormError("Could not save the location. Please try again.");
      return;
    }
    setSaving(false);

    if (!result.ok) {
      setFormError(result.error);
      return;
    }

    setLocations(normalized);
    setDialogOpen(false);
    setEditingLocation(null);
    setError(null);
    setFeedback(isNewLocation ? "Location added" : "Location updated");
    setExpanded(true);
    router.refresh();
  }

  async function removeLocation(location: DomainLocation) {
    if (!window.confirm(`Remove ${location.label}?`)) return;

    const remaining = locations.filter((item) => item.id !== location.id);
    const preferredPrimaryId = location.isPrimary
      ? remaining[0]?.id
      : locations.find((item) => item.isPrimary)?.id;
    const normalized = normalizeLocations(remaining, preferredPrimaryId);

    setRemovingId(location.id);
    setError(null);
    setFeedback(null);
    let result;
    try {
      result = await updateDomainAction(domainId, { locations: normalized });
    } catch {
      setRemovingId(null);
      setError("Could not remove the location. Please try again.");
      return;
    }
    setRemovingId(null);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setLocations(normalized);
    setFeedback("Location removed");
    router.refresh();
  }

  function addLocationButton(className: string) {
    return (
      <Button
        type="button"
        variant="secondary"
        onClick={openAdd}
        disabled={saving || removingId !== null || limitReached}
        className={className}
      >
        <Plus />
        Add location
      </Button>
    );
  }

  const listContent = (
    <div className="space-y-3">
      {locations.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No saved locations yet. Add one so visitors can tap the address for
          exact directions.
        </p>
      ) : (
        <div className="space-y-2">
          {locations.map((location) => {
            const typeLabel = locationTypeLabel(location);
            const metadata = [
              typeLabel,
              location.isPrimary ? "Primary" : null,
              location.notes,
            ]
              .filter(Boolean)
              .join(" · ");

            return (
              <div
                key={location.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-input px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {location.label}
                  </p>
                  <a
                    href={locationDirectionsUrl(location)}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="block max-w-full truncate text-xs text-muted-foreground hover:text-foreground hover:underline"
                  >
                    {location.address}
                  </a>
                  <p className="truncate text-xs text-muted-foreground">
                    {metadata}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => openEdit(location)}
                    disabled={saving || removingId !== null}
                    aria-label={`Edit ${location.label}`}
                    title="Edit location"
                  >
                    <Pencil />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => void removeLocation(location)}
                    disabled={saving || removingId !== null}
                    aria-label={`Remove ${location.label}`}
                    title="Remove location"
                  >
                    {removingId === location.id ? (
                      <Loader2
                        className="size-4 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <Trash2 />
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {limitReached ? (
        <p className="text-xs text-muted-foreground">
          Maximum {DOMAIN_LOCATION_LIMIT} locations.
        </p>
      ) : null}

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

  const dialog = (
    <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isNewLocation ? "Add location" : "Edit location"}
          </DialogTitle>
          <DialogDescription>
            Save the short name and the address visitors should tap. Choose what
            kind of place it is so the agent can describe it correctly.
          </DialogDescription>
        </DialogHeader>

        {editingLocation ? (
          <form onSubmit={saveLocation} noValidate className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`${editingLocation.id}-label`}>
                  Short name
                </Label>
                <Input
                  id={`${editingLocation.id}-label`}
                  value={editingLocation.label}
                  onChange={(event) =>
                    updateEditing({ label: event.target.value })
                  }
                  placeholder="Osu branch"
                  maxLength={80}
                  disabled={saving}
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={`${editingLocation.id}-type`}>
                  Location type
                </Label>
                <select
                  id={`${editingLocation.id}-type`}
                  value={resolveLocationType(editingLocation)}
                  onChange={(event) =>
                    updateEditing({
                      locationType: event.target.value as LocationType,
                    })
                  }
                  disabled={saving}
                  className="h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
                >
                  {LOCATION_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`${editingLocation.id}-address`}>
                Address visitors tap
              </Label>
              <Input
                id={`${editingLocation.id}-address`}
                value={editingLocation.address}
                onChange={(event) =>
                  updateEditing({ address: event.target.value })
                }
                placeholder="12 Oxford Street, Osu, Accra"
                maxLength={300}
                disabled={saving}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`${editingLocation.id}-notes`}>
                Notes (optional)
              </Label>
              <textarea
                id={`${editingLocation.id}-notes`}
                value={editingLocation.notes ?? ""}
                onChange={(event) =>
                  updateEditing({ notes: event.target.value || null })
                }
                placeholder="Parking, opening hours, which entrance to use"
                maxLength={500}
                rows={2}
                disabled={saving}
                className="w-full rounded-lg border border-input bg-background px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`${editingLocation.id}-maps`}>
                Google Maps link
              </Label>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  id={`${editingLocation.id}-maps`}
                  value={editingLocation.mapsUrl ?? ""}
                  onChange={(event) => {
                    const value = event.target.value.trim();
                    updateEditing({
                      mapsUrl: value || null,
                      latitude: null,
                      longitude: null,
                      placeId: null,
                    });
                    setPinFeedback(null);
                  }}
                  placeholder="https://maps.app.goo.gl/..."
                  maxLength={1_000}
                  disabled={saving || readingPin}
                  className="min-w-0 flex-1"
                  autoComplete="off"
                  spellCheck={false}
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void readPin()}
                  disabled={saving || readingPin || !editingLocation.mapsUrl}
                  aria-label="Read pin"
                  aria-busy={readingPin}
                >
                  {readingPin ? (
                    <>
                      <Loader2
                        className="size-4 animate-spin"
                        aria-hidden="true"
                      />
                      Reading…
                    </>
                  ) : (
                    "Read pin"
                  )}
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {pinFeedback ? (
                  <span
                    role="status"
                    className={
                      pinFeedback.startsWith("Exact")
                        ? "text-emerald-600"
                        : undefined
                    }
                  >
                    {pinFeedback}
                  </span>
                ) : editingLocation.mapsUrl ? (
                  <span>Paste the exact place link, then read its pin.</span>
                ) : (
                  <span>Paste a Google Maps place link to set the pin.</span>
                )}
                {editingLocation.mapsUrl &&
                isGoogleMapsUrl(editingLocation.mapsUrl) ? (
                  <a
                    href={editingLocation.mapsUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="font-medium underline underline-offset-2"
                  >
                    Open link
                  </a>
                ) : null}
              </div>
            </div>

            <label
              htmlFor={`${editingLocation.id}-primary`}
              className="flex cursor-pointer items-start gap-2 rounded-lg border p-3"
            >
              <Checkbox
                id={`${editingLocation.id}-primary`}
                checked={editingLocation.isPrimary}
                onCheckedChange={(checked) =>
                  updateEditing({ isPrimary: checked })
                }
                disabled={saving}
                className="mt-0.5"
              />
              <span>
                <span className="block text-sm font-medium">
                  Primary location
                </span>
                <span className="block text-xs text-muted-foreground">
                  The agent treats this as the main place when visitors ask
                  where you are.
                </span>
              </span>
            </label>

            {formError ? (
              <p className="text-sm text-destructive" role="alert">
                {formError}
              </p>
            ) : null}

            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleDialogOpenChange(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving || readingPin}>
                {saving ? (
                  <>
                    <Loader2
                      className="size-4 animate-spin"
                      aria-hidden="true"
                    />
                    Saving…
                  </>
                ) : (
                  "Save location"
                )}
              </Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );

  if (showHeader) {
    return (
      <>
        <Card>
          <CardHeader>
            <button
              type="button"
              onClick={() => setExpanded((previous) => !previous)}
              aria-expanded={expanded}
              className="flex w-full items-center justify-between gap-3 text-left"
            >
              <div>
                <CardTitle>
                  Branches &amp; locations ({locations.length})
                </CardTitle>
                <CardDescription className="mt-1">
                  Add the places customers can visit. The agent uses these for
                  exact directions and falls back to the knowledge base when
                  none are saved.
                </CardDescription>
              </div>
              <ChevronDown
                className={`h-4 w-4 shrink-0 transition-transform ${
                  expanded ? "" : "-rotate-90"
                }`}
              />
            </button>
            <CardAction>
              {addLocationButton("hidden sm:inline-flex")}
            </CardAction>
          </CardHeader>
          {expanded ? (
            <CardContent>{listContent}</CardContent>
          ) : null}
          <div className="px-(--card-spacing) sm:hidden">
            {addLocationButton("w-full")}
          </div>
        </Card>
        {dialog}
      </>
    );
  }

  return (
    <>
      <div className="space-y-3">
        <div className="hidden justify-end sm:flex">
          {addLocationButton("hidden sm:inline-flex")}
        </div>
        {listContent}
        {addLocationButton("w-full sm:hidden")}
      </div>
      {dialog}
    </>
  );
}
