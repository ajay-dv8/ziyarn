import { z } from "zod";

/** More branches than this belong in a locations table, not a prompt. */
export const DOMAIN_LOCATION_LIMIT = 10;

const locationIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^loc_[A-Za-z0-9_-]+$/, "Location id must start with loc_");

const oneLine = (maximum: number) =>
  z.string().trim().min(1).max(maximum).regex(/^[^\r\n]+$/);

const optionalOneLine = (maximum: number) =>
  z.string().trim().max(maximum).regex(/^[^\r\n]*$/).optional().nullable();

/**
 * Google Maps hostnames that owners can paste. Keeping this allowlist narrow
 * is what makes server-side short-link resolution safe: the fetch below only
 * ever starts against a Google host.
 */
export function isGoogleMapsUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  if (host === "maps.app.goo.gl") return true;
  if (host === "goo.gl") return url.pathname.startsWith("/maps");

  const bareHost = host.replace(/^(?:www\.|maps\.)/, "");
  const isGoogleHost =
    bareHost === "google.com" ||
    /^google\.(?:co\.[a-z]{2}|com\.[a-z]{2}|[a-z]{2})$/.test(bareHost);

  if (!isGoogleHost) return false;
  return host.startsWith("maps.") || url.pathname.startsWith("/maps");
}

export const domainLocationSchema = z
  .object({
    id: locationIdSchema,
    /** Short internal name ("Osu branch", "Airport shop"). */
    label: oneLine(80),
    /** The full address visitors should tap. */
    address: oneLine(300),
    notes: optionalOneLine(500),
    latitude: z.number().min(-90).max(90).optional().nullable(),
    longitude: z.number().min(-180).max(180).optional().nullable(),
    /** The owner-pasted link, kept as the fallback when no pin was parsed. */
    mapsUrl: z
      .url()
      .max(1_000)
      .refine((value) => isGoogleMapsUrl(value), "Use a Google Maps link")
      .optional()
      .nullable(),
    /** Optional Google Place ID; also exact without coordinates. */
    placeId: z.string().trim().max(300).regex(/^\S+$/).optional().nullable(),
    isPrimary: z.boolean().optional().default(false),
  })
  .refine(
    (location) =>
      (location.latitude === null || location.latitude === undefined) ===
      (location.longitude === null || location.longitude === undefined),
    { message: "Latitude and longitude must be provided together" },
  )
  .refine(
    (location) =>
      Boolean(
        location.mapsUrl ||
          location.placeId ||
          (typeof location.latitude === "number" &&
            typeof location.longitude === "number"),
      ),
    { message: "Add a Google Maps link, coordinates, or a Place ID" },
  );

export const domainLocationsSchema = z
  .array(domainLocationSchema)
  .max(DOMAIN_LOCATION_LIMIT)
  .refine(
    (locations) =>
      new Set(locations.map((location) => location.id)).size ===
      locations.length,
    { message: "Location ids must be unique" },
  );

export type DomainLocation = z.infer<typeof domainLocationSchema>;
export type DomainLocations = z.infer<typeof domainLocationsSchema>;

/** The display/filter fields map-link builders need. */
export type MapLocation = {
  label: string;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
  mapsUrl?: string | null;
  placeId?: string | null;
};

function withSinglePrimary(locations: DomainLocation[]): DomainLocation[] {
  const primaryIndex = locations.findIndex((location) => location.isPrimary);
  const resolvedPrimary = primaryIndex === -1 ? 0 : primaryIndex;
  return locations.map((location, index) => ({
    ...location,
    isPrimary: index === resolvedPrimary,
  }));
}

/** Strict validation for writes. Throws on malformed locations. */
export function parseDomainLocations(value: unknown): DomainLocation[] {
  return withSinglePrimary(domainLocationsSchema.parse(value));
}

/**
 * Fail-open read used on rows written before this feature and on any row that
 * somehow holds stale data. One malformed entry must not hide the others.
 */
export function resolveDomainLocations(value: unknown): DomainLocation[] {
  if (!Array.isArray(value)) return [];
  const locations: DomainLocation[] = [];
  const seenIds = new Set<string>();
  for (const entry of value.slice(0, DOMAIN_LOCATION_LIMIT)) {
    const parsed = domainLocationSchema.safeParse(entry);
    if (!parsed.success || seenIds.has(parsed.data.id)) continue;
    seenIds.add(parsed.data.id);
    locations.push(parsed.data);
  }
  return withSinglePrimary(locations);
}

/** Safe to put inside a prompt marker: no closing bracket or pipe. */
export function locationMarkerLabel(location: MapLocation): string {
  return (location.address || location.label)
    .replace(/[|[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

/**
 * The exact tags the model may emit for saved locations. Coordinates and URLs
 * stay out of the prompt; the widget resolves the id against trusted config.
 */
export function domainLocationsPrompt(locations: DomainLocation[]): string {
  if (locations.length === 0) return "";

  const lines = locations.map((location) => {
    const tag = `[[location: ${location.id}|${locationMarkerLabel(location)}]]`;
    const notes = location.notes ? ` Note: ${location.notes}` : "";
    const primary = location.isPrimary ? " (primary)" : "";
    return `- ${tag} — ${location.label}${primary}.${notes}`;
  });

  return `Business locations (use these exact tags, never invent an id):\n${lines.join("\n")}\nFor a place in this list, output the tag exactly as shown instead of a generic [[location: ...]] tag.`;
}

export type MapPlatform = "ios" | "other";

/**
 * Tapping a saved location opens directions, not a search. Coordinates win;
 * a Place ID is the next exact option; the owner's raw link is the fallback.
 */
export function locationDirectionsUrl(
  location: MapLocation,
  platform: MapPlatform = "other",
): string {
  const latitude = location.latitude;
  const longitude = location.longitude;
  const hasCoordinates =
    typeof latitude === "number" && typeof longitude === "number";

  if (hasCoordinates && platform === "ios") {
    return `https://maps.apple.com/?daddr=${latitude},${longitude}`;
  }

  if (hasCoordinates) {
    const params = new URLSearchParams({
      api: "1",
      destination: `${latitude},${longitude}`,
    });
    if (location.placeId) {
      params.set("destination_place_id", location.placeId);
    }
    return `https://www.google.com/maps/dir/?${params.toString()}`;
  }

  if (location.placeId) {
    const params = new URLSearchParams({
      api: "1",
      destination: location.address || location.label,
      destination_place_id: location.placeId,
    });
    return `https://www.google.com/maps/dir/?${params.toString()}`;
  }

  if (location.mapsUrl) return location.mapsUrl;

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    location.address || location.label,
  )}`;
}
