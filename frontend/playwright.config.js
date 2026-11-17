import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    channel: process.env.PANTRY_BROWSER_CHANNEL || "chromium",
    baseURL: "http://127.0.0.1:4173",
    timezoneId: "America/Chicago",
    locale: "en-US",
    reducedMotion: "reduce",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command:
      "node node_modules/vite/bin/vite.js build --mode e2e --outDir dist-e2e && node node_modules/vite/bin/vite.js preview --outDir dist-e2e --host 127.0.0.1 --port 4173 --strictPort",
    env: {
      VITE_SUPABASE_URL: "https://pantry-browser-test.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_browser_fixture_only",
    },
    timeout: 120000,
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
  },
});
