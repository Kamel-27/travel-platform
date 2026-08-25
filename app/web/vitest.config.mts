import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Resolves the "@/*" alias straight from tsconfig.json — Vite handles this
  // natively now, so no vite-tsconfig-paths plugin.
  resolve: { tsconfigPaths: true },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    // Only unit/component tests. The Playwright specs under e2e/ drive a real
    // browser and are run by `npm run test:e2e`.
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "lcov"],
      // Scoped to the layers this suite actually covers — the shared libs and
      // components. Route pages are exercised by the Playwright smoke run, not
      // here, so folding them in would make the thresholds meaningless. Widen
      // this (and raise the numbers) as page-level tests get added.
      include: ["src/lib/**", "src/components/**"],
      // Static data table and type declarations — nothing to exercise.
      exclude: ["src/lib/types.ts"],
      thresholds: {
        statements: 85,
        branches: 85,
        functions: 85,
        lines: 85,
      },
    },
  },
});
