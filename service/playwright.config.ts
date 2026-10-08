import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./test/browser",
  use: { baseURL: "http://127.0.0.1:8789", viewport: { width: 390, height: 844 } },
  webServer: { command: "node test/browser/server.mjs", port: 8789, reuseExistingServer: false },
});
