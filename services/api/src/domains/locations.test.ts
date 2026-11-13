import { afterEach, describe, expect, it, vi } from "vitest";

import {
  domainLocationsPrompt,
  isGoogleMapsUrl,
  locationDirectionsUrl,
  parseDomainLocations,
} from "@repo/api/domains/locations";
import {
  parseGoogleMapsLink,
  resolveGoogleMapsLink,
} from "@repo/api/domains/maps-link";

const osu = {
  id: "loc_osu",
  label: "Osu branch",
  address: "12 Oxford Street, Osu, Accra",
  notes: "Park at the rear",
  latitude: 5.5502,
  longitude: -0.2174,
  placeId: null,
  isPrimary: true,
};

describe("isGoogleMapsUrl", () => {
  it("accepts share and maps hosts", () => {
    expect(isGoogleMapsUrl("https://maps.app.goo.gl/abc123")).toBe(true);
    expect(isGoogleMapsUrl("https://www.google.com/maps/place/x")).toBe(true);
    expect(isGoogleMapsUrl("https://maps.google.co.uk/?q=5.55,-0.21")).toBe(
      true,
    );
  });

  it("rejects lookalikes and non-https links", () => {
    expect(isGoogleMapsUrl("https://google.evil.com/maps/place/x")).toBe(false);
    expect(isGoogleMapsUrl("https://example.com/maps/place/x")).toBe(false);
    expect(isGoogleMapsUrl("http://www.google.com/maps/place/x")).toBe(false);
  });
});

describe("domain location data", () => {
  it("normalizes to exactly one primary location", () => {
    const locations = parseDomainLocations([
      { ...osu, isPrimary: false },
      { ...osu, id: "loc_second", isPrimary: true },
      { ...osu, id: "loc_third", isPrimary: true },
    ]);

    expect(locations.map((location) => location.isPrimary)).toEqual([
      false,
      true,
      false,
    ]);
  });

  it("rejects half a coordinate pair", () => {
    expect(() =>
      parseDomainLocations([{ ...osu, longitude: null }]),
    ).toThrow();
  });

  it("requires an exact source instead of a geocoded address", () => {
    expect(() =>
      parseDomainLocations([
        {
          ...osu,
          latitude: null,
          longitude: null,
          placeId: null,
          mapsUrl: null,
        },
      ]),
    ).toThrow();
  });

  it("rejects duplicate ids so markers cannot be ambiguous", () => {
    expect(() =>
      parseDomainLocations([osu, { ...osu, isPrimary: false }]),
    ).toThrow();
  });

  it("puts a safe tag and no coordinates in the prompt", () => {
    const prompt = domainLocationsPrompt([osu]);

    expect(prompt).toContain(
      "[[location: loc_osu|12 Oxford Street, Osu, Accra]]",
    );
    expect(prompt).toContain("(primary)");
    expect(prompt).toContain("Park at the rear");
    expect(prompt).not.toContain("5.5502");
  });
});

describe("locationDirectionsUrl", () => {
  it("uses Apple Maps directions on iOS when coordinates exist", () => {
    expect(locationDirectionsUrl(osu, "ios")).toBe(
      "https://maps.apple.com/?daddr=5.5502,-0.2174",
    );
  });

  it("uses Google Maps directions with coordinates", () => {
    expect(locationDirectionsUrl(osu)).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=5.5502%2C-0.2174",
    );
  });

  it("uses a Place ID when coordinates are missing", () => {
    expect(
      locationDirectionsUrl({
        ...osu,
        latitude: null,
        longitude: null,
        placeId: "ChIJ123",
      }),
    ).toContain("destination_place_id=ChIJ123");
  });

  it("falls back to the owner's exact link", () => {
    expect(
      locationDirectionsUrl({
        ...osu,
        latitude: null,
        longitude: null,
        mapsUrl: "https://maps.app.goo.gl/abc123",
      }),
    ).toBe("https://maps.app.goo.gl/abc123");
  });
});

describe("parseGoogleMapsLink", () => {
  it("prefers the pin over the map viewport", () => {
    const parsed = parseGoogleMapsLink(
      "https://www.google.com/maps/place/Urban+Plus/@5.5502,-0.2174,17z/data=!3d5.5510!4d-0.2160",
    );

    expect(parsed.latitude).toBe(5.551);
    expect(parsed.longitude).toBe(-0.216);
  });

  it("reads coordinates and Place IDs from query parameters", () => {
    const parsed = parseGoogleMapsLink(
      "https://www.google.com/maps/search/?api=1&query=5.5502%2C-0.2174&query_place_id=ChIJ123",
    );

    expect(parsed.latitude).toBe(5.5502);
    expect(parsed.longitude).toBe(-0.2174);
    expect(parsed.placeId).toBe("ChIJ123");
  });

  it("rejects a non-Google URL before any fetch could happen", () => {
    expect(() =>
      parseGoogleMapsLink("https://example.com/maps/place/x"),
    ).toThrow();
  });
});

describe("resolveGoogleMapsLink", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("follows a short link once and reads the final pin", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: {
          location:
            "https://www.google.com/maps/place/Urban+Plus/@5.55,-0.21,17z/data=!3d5.5502!4d-0.2174",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const parsed = await resolveGoogleMapsLink("https://maps.app.goo.gl/abc");

    expect(parsed.latitude).toBe(5.5502);
    expect(parsed.longitude).toBe(-0.2174);
    expect(parsed.mapsUrl).toBe("https://maps.app.goo.gl/abc");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refuses a redirect away from Google Maps", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: "https://example.com/not-maps" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      resolveGoogleMapsLink("https://maps.app.goo.gl/abc"),
    ).rejects.toThrow("does not point to Google Maps");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
