import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: [
      "artifacts/api-server/server/**/*.test.ts",
      "artifacts/orbit/src/**/*.test.ts",
      "scripts/src/**/*.test.ts",
    ],
  },
});
