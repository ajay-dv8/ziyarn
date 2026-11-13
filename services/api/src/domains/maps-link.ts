import { isGoogleMapsUrl } from "@repo/api/domains/locations";

const MAX_URL_LENGTH = 1_500;
const SHORT_LINK_TIMEOUT_MS = 5_000;
const MAX_REDIRECTS = 4;
const SHORT_LINK_HOSTS = new Set(["maps.app.goo.gl"]);

export class MapsLinkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MapsLinkError";
  }
}

export type ParsedMapsLink = {
  latitude: number | null;
  longitude: number | null;
  placeId: string | null;
  /** Always the owner's original link, kept as the fallback. */
  mapsUrl: string;
};

function coordinatesFromUrl(url: URL): {
  latitude: number | null;
  longitude: number | null;
} {
  const source = `${url.pathname}?${url.search}`;

  // A place URL carries the pin in !3dLAT!4dLNG. Prefer it over the map
  // viewport (@lat,lng), which can be the surrounding area instead.
  const pin = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/.exec(source);
  const viewport = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(source);
  const match = pin ?? viewport;
  if (match) {
    const latitude = Number(match[1]);
    const longitude = Number(match[2]);
    if (
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      Math.abs(latitude) <= 90 &&
      Math.abs(longitude) <= 180
    ) {
      return { latitude, longitude };
    }
  }

  for (const key of [
    "q",
    "query",
    "destination",
    "daddr",
    "ll",
    "center",
    "sll",
  ]) {
    const value = url.searchParams.get(key);
    if (!value || value.startsWith("place_id:")) continue;
    const coordinates = /(?:loc:)?\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/.exec(
      value,
    );
    if (!coordinates) continue;
    const latitude = Number(coordinates[1]);
    const longitude = Number(coordinates[2]);
    if (
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      Math.abs(latitude) <= 90 &&
      Math.abs(longitude) <= 180
    ) {
      return { latitude, longitude };
    }
  }

  return { latitude: null, longitude: null };
}

function placeIdFromUrl(url: URL): string | null {
  for (const key of [
    "query_place_id",
    "destination_place_id",
    "place_id",
  ]) {
    const value = url.searchParams.get(key);
    if (value) return value;
  }

  for (const key of ["q", "query"]) {
    const value = url.searchParams.get(key);
    if (value?.startsWith("place_id:")) {
      return value.slice("place_id:".length) || null;
    }
  }

  return null;
}

/** Parses a full Google Maps URL. Short links need {@link resolveGoogleMapsLink}. */
export function parseGoogleMapsLink(raw: string): ParsedMapsLink {
  const mapsUrl = raw.trim();
  if (!mapsUrl || mapsUrl.length > MAX_URL_LENGTH) {
    throw new MapsLinkError("Paste a Google Maps link.");
  }
  if (!isGoogleMapsUrl(mapsUrl)) {
    throw new MapsLinkError("Paste a link from Google Maps.");
  }

  const url = new URL(mapsUrl);
  const { latitude, longitude } = coordinatesFromUrl(url);
  return {
    latitude,
    longitude,
    placeId: placeIdFromUrl(url),
    mapsUrl,
  };
}

function isShortLink(url: URL): boolean {
  if (SHORT_LINK_HOSTS.has(url.hostname.toLowerCase())) return true;
  return (
    url.hostname.toLowerCase() === "goo.gl" &&
    url.pathname.startsWith("/maps")
  );
}

/**
 * Resolves a shortened share link by following redirects, but only after the
 * current hop has passed the Google Maps allowlist. This keeps the server from
 * becoming an open URL fetcher.
 */
export async function resolveGoogleMapsLink(
  raw: string,
): Promise<ParsedMapsLink> {
  const original = parseGoogleMapsLink(raw);
  const initial = new URL(original.mapsUrl);
  if (!isShortLink(initial)) return original;

  let current = initial;
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    if (!isGoogleMapsUrl(current.toString())) {
      throw new MapsLinkError("That link does not point to Google Maps.");
    }
    // A redirect chain normally lands on a full Maps URL. Parse that directly
    // instead of making one more request for a page we do not read.
    if (!isShortLink(current)) break;

    let response: Response;
    try {
      response = await fetch(current, {
        method: "GET",
        redirect: "manual",
        signal: AbortSignal.timeout(SHORT_LINK_TIMEOUT_MS),
        headers: {
          "user-agent":
            "Mozilla/5.0 (compatible; Ziyarn/1.0; +https://ziyarn.com)",
        },
      });
    } catch {
      throw new MapsLinkError(
        "Could not open that link. Paste the full Google Maps URL instead.",
      );
    }

    const location = response.headers.get("location");
    if (
      response.status >= 300 &&
      response.status < 400 &&
      location &&
      redirect < MAX_REDIRECTS
    ) {
      await response.body?.cancel();
      current = new URL(location, current);
      continue;
    }
    await response.body?.cancel();

    if (response.status >= 400) {
      throw new MapsLinkError(
        "Could not open that link. Paste the full Google Maps URL instead.",
      );
    }
    break;
  }

  const resolved = new URL(current.toString());
  if (!isGoogleMapsUrl(resolved.toString())) {
    throw new MapsLinkError("That link does not point to Google Maps.");
  }

  const { latitude, longitude } = coordinatesFromUrl(resolved);
  return {
    latitude,
    longitude,
    placeId: placeIdFromUrl(resolved),
    // Keep the short link the owner pasted: it is stable and is the fallback
    // if Google changes the long URL's structure.
    mapsUrl: original.mapsUrl,
  };
}
