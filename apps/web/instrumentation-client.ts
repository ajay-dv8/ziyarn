import * as Sentry from "@sentry/nextjs";

import { sharedSentryOptions } from "./lib/sentry-shared";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  ...sharedSentryOptions,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
