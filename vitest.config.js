import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["test/**/*.test.js"],
    coverage: {
      provider: "v8",
      include: ["functions/**/*.js"],
      exclude: [
        "functions/_data/**",
        "functions/api/auth/**",
        "functions/api/proxy.js",
        "functions/_middleware.js",
      ],
    },
    testTimeout: 15000,
  },
});
