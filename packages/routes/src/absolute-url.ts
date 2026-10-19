/**
 * Joins an origin with one of the paths in this package.
 *
 * The callers are server-side — a Stripe `return_url`, a booking link in an
 * email, a cron job's dashboard link — so the path has to be prefixed with an
 * origin that is either configured (`BASE_APP_URL`) or derived from the
 * request. Concatenating by hand is how the two get out of step: configured
 * origins arrive both with and without a trailing slash, and
 * `https://app.example.com//dashboard` is a different string from the one in
 * `APP_ROUTES`. That matters to anything that compares URLs rather than merely
 * fetching them — redirect allowlists, email link checks, signature payloads.
 *
 * An empty origin is allowed and yields the bare path, which is what
 * `process.env.BETTER_AUTH_URL ?? ""` produces when the variable is unset.
 */
export function absoluteUrl(origin: string, path: string): string {
  return `${origin.replace(/\/+$/, "")}${path}`;
}
