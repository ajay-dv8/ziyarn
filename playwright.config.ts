import { defineConfig } from "@playwright/test";

// The E2E seed writes to the same database the app reads. Keep the database
// URL out of the test file so a disposable branch can be selected per run.
try {
  process.loadEnvFile("apps/web/.env");
} catch {
  // CI supplies its own environment.
}

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3100";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 30_000 },
  reporter: [["list"]],
  use: {
    baseURL,
    navigationTimeout: 60_000,
    trace: "retain-on-failure",
  },
  // A fresh dev server per run resets Better Auth's in-memory sign-up limit.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command:
          'cd apps/web && rm -rf .next && NODE_OPTIONS="--max-old-space-size=3072" /usr/bin/script -qec "taskset -c 0-2 node ./node_modules/next/dist/bin/next dev --port 3100" /tmp/opencode/e2e-dev.log',
        url: `${baseURL}/sign-in`,
        reuseExistingServer: false,
        timeout: 240_000,
        env: {
          DATABASE_URL: process.env.E2E_DATABASE_URL ?? "",
          BETTER_AUTH_URL: baseURL,
          NEXT_PUBLIC_BETTER_AUTH_URL: baseURL,
          BASE_APP_URL: baseURL,
        },
      },
});
