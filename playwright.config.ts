import { defineConfig } from "@playwright/test";

const port = 3178;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  use: { baseURL },
  webServer: {
    command: `node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port ${port}`,
    url: baseURL,
  },
});
