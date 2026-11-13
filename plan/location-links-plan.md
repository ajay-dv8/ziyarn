# Widget Location Links Plan

Status: implemented. Phase 2 (deterministic marker) shipped first; the verified
location pin from Option 3 now supplies exact coordinates or a Place ID, with
the owner's Google Maps link as fallback. See "Option 3" and "Implementation
notes".

## Goal

When an agent's reply names a specific place a visitor could visit, tapping the
place opens it in Google Maps — the app on mobile when installed, the browser
otherwise. This covers both direct questions ("Where are you located?") and
places mentioned in passing.

## Non-goals

- Geocoding, address autocomplete, or map embeds.
- Detecting locations in arbitrary text with regex or NER. Place names have no
  reliable shape: "Accra Mall" looks like ordinary words. The AI already knows
  when it is naming a place, so it should mark it.
- Route planning, "near me" search, or a map preview card.
- Click analytics.
- Opening hours, staff, or per-branch booking rules. A separate locations table
  can own those when they are needed.

## Current state

- Both widget surfaces already render markdown links and bare `http(s)` URLs as
  clickable links with `target="_blank" rel="noopener noreferrer"`:
  - Classic: `apps/web/widget/helpers.js` (`renderMd`) and
    `apps/web/widget/base.css` (`.zy-msg a`).
  - Sleek React: `apps/web/lib/widget-markdown.ts` (parser) and
    `apps/web/components/widget/widget-markdown.tsx` (renderer).
- Links survive history reloads. Nothing extra is needed for the click itself.
- `isSafeLinkUrl` and `isMdSafeUrl` allow only `http(s)` and `mailto`, so a
  Google Maps HTTPS link is already permitted.
- There is no address or location field in the database. The AI learns
  locations from the knowledge base, the agent description/instructions, or
  business-type defaults.
- `services/api/src/chat/server.ts` (`systemPromptFor`) currently forbids
  constructing URLs:
  > Never invent, guess, or construct URLs from the domain slug; only use URLs
  > supplied by knowledge results, the product catalog, or tool results...

## Why the AI marks the location

A browser cannot reliably tell a place from ordinary text. A regex would link
random words or miss "Accra Mall" entirely, and adding an NER/geocoding API
adds cost, latency, and ambiguity. The model already decides whether it is
answering with a real place, so the cheapest reliable design is a prompt rule
that makes the place a Maps link.

## Option 3 — Verified Location Pin (implemented)

The owner saves each visitable place on the domain instead of relying on the
model to copy an address from knowledge or build a URL.

### Data

`domains.locations` is a JSONB array (MVP) validated by
`domainLocationsSchema`:

```json
[
  {
    "id": "loc_osu",
    "label": "Osu branch",
    "address": "12 Oxford Street, Osu, Accra",
    "notes": "Park at the rear",
    "latitude": 5.5502,
    "longitude": -0.2174,
    "mapsUrl": "https://maps.app.goo.gl/...",
    "placeId": null,
    "isPrimary": true
  }
]
```

Exactly one location is primary. The column is additive and defaults to `[]`;
a locations table is deferred until branches need hours or other per-place
rules.

### Owner flow

**Dashboard → Domains → Settings → Locations** asks for a short name, the
address visitors tap, optional notes, and a Google Maps link. **Read pin**
parses a full link or follows a short `maps.app.goo.gl` share link on the
server (Google hosts only, timeout and redirect limits), then shows the parsed
coordinates or Place ID. The raw link is kept whether or not a pin was found.

### Prompt and widget

- `systemPromptFor` lists the saved places with exact tags such as
  `[[location: loc_osu|12 Oxford Street, Osu, Accra]]`. Coordinates and URLs
  stay out of the prompt.
- Both widget parsers resolve the id against the public `/api/chat` config.
  Known ids render the **stored** address and never trust a model-supplied
  label; unknown ids render their readable label without inventing a link.
- Old `[[location: place name]]` markers still render a Maps search for
  existing conversations.
- Directions links use coordinates when available:
  - Google: `https://www.google.com/maps/dir/?api=1&destination=lat,lng`
  - iOS: `https://maps.apple.com/?daddr=lat,lng`
  - Place ID: `destination_place_id=...`, with the address as display text
  - Raw owner link: last fallback
- Dashboard conversation bubbles strip the marker to its readable label.

## Phase 1 — Prompt-only (recommended first)

### Changes

1. `services/api/src/chat/server.ts` — in `systemPromptFor`:
   - Scope the existing URL rule to **source** URLs so it still prevents
     invented source links, and explicitly allow self-constructed Maps links.
   - Add a locations rule. Proposed text:

     > When your answer names a specific place a visitor could visit — a street
     > address, office, branch, shop, or venue — make the place itself a Google
     > Maps link:
     > `[12 Oxford Street, Osu, Accra](https://www.google.com/maps/search/?api=1&query=12+Oxford+Street,+Osu,+Accra)`.
     > Replace spaces with `+` and do not add spaces to the URL. Only link a
     > place that appears in the knowledge results, tool results, or business
     > instructions; never guess a location. Do not link broad regions,
     > countries, or online services.

2. `services/api/src/chat/server.test.ts`:
   - Update the existing "supplied source URLs" assertion if the wording
     changes.
   - Add an assertion that the prompt contains the Maps rule and example query.

No widget or database changes. The model emits a normal markdown link; both
surfaces already render it.

### Verification gate

Use one scratch domain/agent with a knowledge entry containing a known address,
for example:

> Our office is at 12 Oxford Street, Osu, Accra. We are open Monday to Friday,
> 9am–5pm.

Run these prompts three times each, on the platform model and one BYO provider:

| Kind | Prompt | Expected |
|------|--------|----------|
| Location | Where are you located? | Address text is a tappable Maps link |
| Location | What's your office address? | Same |
| Location | Can I visit your shop? | Address or venue is linked |
| Location | Is there parking at your venue? | Venue/address is linked |
| Location | I'm looking for your branch in Osu | Branch/address is linked |
| Control | Do you deliver nationwide? | No Maps link |
| Control | What are your opening hours? | No Maps link |
| Control | Tell me about your return policy. | No Maps link |

Check both widget variants, in the dashboard preview and when embedded, and
reload the conversation to confirm history links still work.

Pass criteria:

- Every location prompt produces a working, tappable link.
- Every control prompt produces no Maps link.
- The link opens Google Maps (app or browser) on Android Chrome and iOS Safari.

If any link is malformed, not tappable, missing from a location answer, or
present on a control answer more than once across the runs, move to Phase 2.

### Known limitations

- The model can still omit a link. That is why Phase 2 exists.
- A URL with raw spaces will not parse as a link. The prompt tells the model to
  use `+`; uncommon characters (`#`, `&` in an address) can still break the
  query. Phase 2 removes this failure by encoding in the widget.
- The Google Maps link opens the Google Maps app when installed, otherwise the
  browser. It does not force Apple Maps or the device's default map app.
- The prompt becomes longer for every request, but only by a short paragraph.

## Phase 2 — Deterministic location marker (conditional)

Build this only if the Phase 1 gate fails. The model supplies the place text;
the widget builds the URL, so encoding is always correct and no URL is
model-generated.

### Syntax

The model writes:

```
[[location: 12 Oxford Street, Osu, Accra]]
```

### Changes

1. `services/api/src/chat/server.ts` — replace the Phase 1 maps-link rule with
   the marker rule. Keep the "only real places" constraint. The source-URL rule
   goes back to its original scope.

2. `apps/web/lib/widget-markdown.ts` — before markdown link parsing, recognize
   a complete marker and emit a normal `link` node:
   - `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`
   - Trim the place, reject newlines, and cap it (for example 300 characters).
   - No new node kind is needed; the existing link renderer already handles
     `target`, `rel`, and styling.
   - Only complete markers are parsed. An incomplete marker falls back to
     literal text, matching the parser's existing partial-markdown convention.
     If the raw marker flash during streaming is distracting, hide an
     unterminated trailing marker while streaming (requires passing a
     streaming flag).

3. `apps/web/widget/helpers.js` — the same recognition in `renderMdInline`,
   using `esc()` for the label and attribute. Build the URL with
   `encodeURIComponent`.

4. Tests:
   - `apps/web/lib/widget-markdown.test.ts`: complete marker becomes a link
     with the encoded URL; special characters (`&`, `#`, unicode) encode
     correctly; incomplete markers stay text; over-long markers do not link;
     injected HTML stays escaped.
   - Classic has no unit test for `renderMd`; add a case to
     `apps/web/scripts/widget-e2e.mjs` or verify manually.
   - Re-run the Phase 1 manual gate with the marker prompt.

5. Run `pnpm --filter web build:widget` and commit the regenerated
   `apps/web/public/widget.js`. Never hand-edit it.

### Optional polish

A map-pin icon or a slightly stronger affordance. Skip unless the underlined
link is not obviously tappable in the widget.

## Deferred / optional

- **Locations table.** The JSONB array is enough for the MVP. Move to a table
  when branches need opening hours, staff, booking rules, or more than 10
  places.
- **Android `geo:` links.** The Google Maps HTTPS link opens the Google Maps
  app when installed and the browser otherwise. `geo:` would open the device's
  default map app, but needs real-device testing and a broader link allowlist.
- **Map picker or Places autocomplete.** Pasting a Google Maps link is the
  zero-API-key path. A picker can come later if owners find links hard to copy.
- **Richer location card.** Address, map preview, and a directions button, like
  the product card. More UI work on both surfaces; the link is enough for the
  requested behavior.
- **Tap analytics.**

## Risks

- The model can mention an incorrect or invented place. The prompt limits links
  to places from knowledge, tools, or business instructions, but the link is
  only as accurate as the answer.
- The clicked URL sends the location text to Google. That is expected for a
  Maps link.
- App handoff is controlled by the OS and browser; test on real devices, not
  only desktop emulation.
- Classic and sleek are separate renderers. Any Phase 2 parser change must be
  made in both, and `public/widget.js` must be rebuilt and committed.
- A prompt change applies to every domain immediately; there is no feature
  flag. Reverting is a prompt revert.
- The existing `systemPromptFor` test asserts the current URL wording. Update
  it deliberately when the rule is scoped to source URLs.

## Definition of done (Phase 1)

- [ ] System prompt includes the Maps rule and the source-URL rule is scoped.
- [ ] `systemPromptFor` test updated and a Maps-rule assertion added.
- [ ] Five location prompts produce tappable links; three control prompts do
      not.
- [ ] Classic and sleek widgets verified, including history reload.
- [ ] Android Chrome and iOS Safari checked; note app versus browser behavior.
- [ ] `pnpm --filter @repo/api test`, `pnpm --filter web check-types`, and
      `pnpm --filter web lint` pass.
- [ ] No database changes.

## Decisions taken

1. **Marker path instead of model-built URLs.** The widget builds the Maps URL,
   so the model only supplies the place text. This removes malformed-URL
   failures and works for every provider.
2. **Google Maps universal link everywhere.** It opens the Google Maps app when
   installed and the browser otherwise. Apple Maps/device-default links remain
   deferred.
3. **Business location field deferred.** Knowledge and business details are
   enough for the current behavior.
4. **Plain underlined link.** No pin icon or card; the existing link styling is
   clear and consistent with source links.

## Implementation notes

Implemented:

- System prompt marker rule in `systemPromptFor`
  (`services/api/src/chat/server.ts`) and its unit test.
- Marker parsing in `apps/web/lib/widget-markdown.ts` and
  `apps/web/widget/helpers.js`. Incomplete markers show their place text while
  streaming and never expose the raw `[[location:` prefix.
- Maps URL built with `encodeURIComponent`; the link keeps `target="_blank"` and
  `rel="noopener noreferrer"`.
- Dashboard conversation bubbles and previews strip the marker for plain text.
- Widget e2e fake reply includes a marker, and both classic and glow assert the
  resulting link. `public/widget.js` was rebuilt.

### Verified pin (Option 3) implementation notes

Implemented:

- `domains.locations` JSONB column, validation and prompt injection.
- Locations card in domain settings: paste a Google Maps link, read the pin
  (short links resolved server-side), confirm, save.
- `[[location: id|label]]` support in both widget parsers, with exact
  Google/Apple directions links and raw-link fallback.
- Old `[[location: place]]` markers and existing conversations still render.
- `public/widget.js` rebuilt.

Verification after Option 3:

- `@repo/api`: 191 passed, 11 skipped.
- `web`: 57 passed.
- Widget e2e: 32/32, including the exact directions link in classic, glow, and
  restored history.
- Typecheck, lint, and the production web build pass.

Remaining: apply migration `0035_domain_locations.sql` to each deployed
database; check app handoff on a real Android and iPhone. Map picking and
Android `geo:` links are still deferred.
