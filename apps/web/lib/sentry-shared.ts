/**
 * Options shared by the browser, Node, and edge Sentry configs.
 *
 * Customer conversations are the product, so Sentry must never become a second
 * copy of them. This module removes the obvious PII carriers (user identity,
 * cookies, auth headers, portal tokens in query strings) and scrubs emails and
 * phone numbers from captured messages. Request bodies are not captured by
 * default; do not enable them.
 */

const SENSITIVE_HEADERS = [
  "authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
  "x-cron-secret",
  "x-embed-secret",
  "x-paystack-signature",
  "stripe-signature",
  "svix-signature",
] as const;

const SENSITIVE_QUERY_PARAMS = [
  "token",
  "t",
  "key",
  "code",
  "secret",
  "email",
  "signature",
  "state",
] as const;

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_CANDIDATE_PATTERN = /\+?\d[\d\s().-]{7,}\d/g;

function scrubText(value: string): string {
  return value
    .replace(EMAIL_PATTERN, "[email]")
    .replace(PHONE_CANDIDATE_PATTERN, (candidate) => {
      // Dates (2026-10-21) and short ids are not phone numbers. Requiring at
      // least nine digits keeps stack traces and timestamps readable.
      return candidate.replace(/\D/g, "").length >= 9 ? "[phone]" : candidate;
    });
}

function scrubUrl(value: string): string {
  const isAbsolute = /^https?:\/\//i.test(value);

  try {
    const url = new URL(value, "https://sentry.invalid");
    for (const parameter of SENSITIVE_QUERY_PARAMS) {
      url.searchParams.delete(parameter);
    }
    return isAbsolute ? url.toString() : `${url.pathname}${url.search}`;
  } catch {
    return value;
  }
}

type ScrubbableEvent = {
  message?: string;
  user?: unknown;
  request?: {
    url?: string;
    cookies?: unknown;
    headers?: Record<string, string>;
  };
  exception?: {
    values?: Array<{ value?: string }>;
  };
  breadcrumbs?: Array<{
    message?: string;
    data?: Record<string, unknown>;
  }>;
};

/** Mutates a Sentry error event in place and returns it. */
export function scrubSentryEvent<T>(event: T): T {
  const scrubbable = event as ScrubbableEvent;

  delete scrubbable.user;

  if (scrubbable.request) {
    delete scrubbable.request.cookies;

    if (scrubbable.request.headers) {
      for (const header of SENSITIVE_HEADERS) {
        delete scrubbable.request.headers[header];
      }
    }

    if (scrubbable.request.url) {
      scrubbable.request.url = scrubUrl(scrubbable.request.url);
    }
  }

  if (scrubbable.message) {
    scrubbable.message = scrubText(scrubbable.message);
  }

  for (const exception of scrubbable.exception?.values ?? []) {
    if (exception.value) exception.value = scrubText(exception.value);
  }

  for (const breadcrumb of scrubbable.breadcrumbs ?? []) {
    if (breadcrumb.message) breadcrumb.message = scrubText(breadcrumb.message);
  }

  return event;
}

export const sharedSentryOptions = {
  environment: process.env.NODE_ENV,
  sendDefaultPii: false,
  ignoreErrors: [
    // Next.js control-flow "errors" are not failures.
    "NEXT_NOT_FOUND",
    "NEXT_REDIRECT",
    "NEXT_HTTP_ERROR_FALLBACK;404",
  ],
  beforeSend: scrubSentryEvent,
};
