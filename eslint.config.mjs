import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Charting libraries may only be imported by the adapters in components/charts.
    // Everything else talks to the chart-neutral envelope, which is what lets the
    // Recharts-vs-Chart.js decision be reversed without touching a widget (PLAN D7).
    files: ["lib/**/*.{ts,tsx}", "components/widgets/**/*.{ts,tsx}", "components/dashboard/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "recharts", message: "Import a chart adapter from @/components/charts instead." },
            { name: "chart.js", message: "Import a chart adapter from @/components/charts instead." },
            { name: "react-chartjs-2", message: "Import a chart adapter from @/components/charts instead." },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendored third-party: the palette validator from the dataviz reference
    // implementation. Kept byte-identical apart from added `export` keywords so it
    // can be re-synced upstream; linting it would invite local edits.
    "scripts/lib/**",
    // Build/audit output.
    "coverage/**",
    "playwright-report/**",
    ".lighthouseci/**",
  ]),
]);

export default eslintConfig;
