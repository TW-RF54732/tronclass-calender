import { defineConfig } from "vitest/config";
import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
export default defineConfig({
  plugins: [cloudflareTest({
    wrangler: { configPath: "./wrangler.jsonc" },
    miniflare: {
      bindings: { TRONCLASS_SESSION_ID: "fixture-session", TRONCLASS_USER_ID: "42", WEB_ACCESS_KEY: "fixture-web-key", CALENDAR_TOKEN: "fixture-calendar-token" },
    },
  })],
  test: { include: ["test/**/*.test.ts"], fileParallelism: false },
});
