import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vitest/config";

// Note: the React plugin is the SWC one, not @vitejs/plugin-react. The Babel-based
// plugin pulls @babel/core@8 (rc) through @rolldown/plugin-babel, which conflicts with
// the Babel 7 that `shadcn` pins. SWC sidesteps Babel entirely and is faster.

export default defineConfig({
  plugins: [react()],
  // Vite resolves tsconfig "paths" (the @/* alias) natively; no plugin needed.
  resolve: { tsconfigPaths: true },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["**/*.{test,spec}.{ts,tsx}"],
    // tests/e2e is Playwright's; it must not be collected by Vitest.
    exclude: ["node_modules/**", ".next/**", "tests/e2e/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "json-summary"],
      /**
       * Count every production source file, not only the ones a test happened to
       * import. Without this, adding an untested module quietly *raises* the
       * percentage, which is the main way a coverage gate gets gamed.
       *
       * `app/**` is absent on purpose: routes and async server components are covered
       * by Playwright (PLAN §14, tier 4), and Vitest cannot render async server
       * components anyway. `components/ui/**` is vendored shadcn.
       */
      include: [
        "lib/**/*.{ts,tsx}",
        "hooks/**/*.{ts,tsx}",
        "components/dashboard/**/*.{ts,tsx}",
        "components/scope/**/*.{ts,tsx}",
        "components/charts/**/*.{ts,tsx}",
        "components/widgets/**/*.{ts,tsx}",
      ],
      exclude: [
        "**/*.test.{ts,tsx}",
        "**/*.stories.tsx",
        "**/types.ts", // type-only modules have no runtime to cover
        "lib/data/fixtures/**", // PLAN §0: demo-grade, deleted at client kickoff
        "lib/utils.ts", // single re-export from the shadcn scaffold
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
        // Pure logic is where the bugs live and where coverage is cheap (PLAN §14).
        "lib/**": { lines: 95, functions: 95, branches: 90, statements: 95 },
        "components/dashboard/**": { lines: 80, functions: 80, branches: 75, statements: 80 },
        "components/scope/**": { lines: 80, functions: 80, branches: 75, statements: 80 },
      },
    },
  },
});
