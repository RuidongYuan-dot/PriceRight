import { defineConfig } from "@playwright/test";

const port = 3178;
const baseURL = `http://127.0.0.1:${port}`;
const ci = !!process.env.CI;

export default defineConfig({
  testDir: "./tests/e2e",
  reporter: ci ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    screenshot: ci ? "only-on-failure" : "off",
    trace: ci ? "retain-on-failure" : "off",
  },
  webServer: {
    command: `node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port ${port}`,
    url: baseURL,
    timeout: ci ? 180_000 : 60_000,
  },
});
