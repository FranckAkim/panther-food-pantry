import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/connected-browser",
  workers: 1,
  retries: 0,
  reporter: "list",
  timeout: 60000,
  use: {
    ...devices["Desktop Chrome"],
    channel: process.env.PANTRY_BROWSER_CHANNEL || "chromium",
    baseURL: "http://127.0.0.1:4174",
    timezoneId: "America/Chicago",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4174 --strictPort",
    url: "http://127.0.0.1:4174",
    reuseExistingServer: false,
  },
});
