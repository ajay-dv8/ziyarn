"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main
          style={{
            display: "flex",
            minHeight: "100vh",
            alignItems: "center",
            justifyContent: "center",
            padding: "1.5rem",
            textAlign: "center",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <div style={{ display: "grid", gap: "1rem", justifyItems: "center" }}>
            <div>
              <h1 style={{ fontSize: "1.125rem", fontWeight: 600 }}>
                Something went wrong
              </h1>
              <p style={{ fontSize: "0.875rem", opacity: 0.7 }}>
                The app hit an unexpected error. Try again — if it keeps
                happening, let us know.
              </p>
            </div>
            <button
              onClick={reset}
              style={{
                border: "1px solid currentColor",
                borderRadius: "0.375rem",
                padding: "0.5rem 1rem",
                fontSize: "0.875rem",
                fontWeight: 500,
                background: "transparent",
                cursor: "pointer",
              }}
              type="button"
            >
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
