#!/usr/bin/env node
/**
 * Measure the palette that actually ships.
 *
 * Reads the tokens straight out of `app/globals.css` rather than duplicating them, so
 * this cannot drift from what the browser renders. Run by `npm run validate:palette`
 * and by CI. When the client hands over their brand colours, re-run this and get an
 * answer in seconds instead of an argument (PLAN §11.5).
 *
 * Checks:
 *   1. Categorical slots, light and dark, adjacent pairs   — the legend-ordered case
 *   2. Categorical slots, all pairs, at the scatter budget — the no-adjacency case
 *   3. Matrix tints: text contrast on every tint           — tints carry text
 *   4. Matrix tints: arm separation, normal vision and CVD — above vs. below baseline
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { contrast, deltaE, validate } from "./lib/validate-palette-core.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CSS = readFileSync(resolve(ROOT, "app/globals.css"), "utf8");

const SERIES_SLOTS = 8;
const SCATTER_BUDGET = 3; // keep in sync with SERIES_BUDGET.all in lib/viz/palette.ts
const TEXT_CONTRAST_MIN = 4.5;
const ARM_SEPARATION_MIN = 15; // OKLab ΔE×100, normal vision
const ARM_SEPARATION_CVD_MIN = 8; // worst of protan/deutan

let failures = 0;
const fail = (msg) => {
  failures++;
  console.log(`  [FAIL] ${msg}`);
};
const pass = (msg) => console.log(`  [PASS] ${msg}`);

/**
 * The core validator reports a check's state as either a boolean or one of
 * "pass" | "fail" | "floor" | "relief". Normalise before branching on it —
 * `"fail"` is truthy, so a naive check silently passes every failure.
 */
const stateOf = (state) => {
  if (state === false || state === "fail") return "fail";
  if (state === "floor" || state === "relief") return "warn";
  return "pass";
};

function reportChecks(result) {
  for (const [name, state, detail] of result.report) {
    const normalised = stateOf(state);
    if (normalised === "fail") fail(`${name}: ${detail}`);
    else console.log(`  [${normalised === "warn" ? "WARN" : "PASS"}] ${name}`);
  }
}

// -- token extraction ----------------------------------------------------------

/**
 * The `:root { ... }` and `.dark { ... }` declaration blocks, by brace matching.
 *
 * The selector is anchored to the start of a line: a bare `indexOf(".dark")` finds the
 * `@custom-variant dark (&:is(.dark *))` declaration near the top of the file and then
 * brace-matches the wrong block entirely.
 */
function block(selector) {
  const anchored = new RegExp(`^${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{`, "m");
  const match = anchored.exec(CSS);
  if (!match) throw new Error(`no ${selector} block in globals.css`);
  const start = match.index;
  const open = CSS.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < CSS.length; i++) {
    if (CSS[i] === "{") depth++;
    else if (CSS[i] === "}" && --depth === 0) return CSS.slice(open + 1, i);
  }
  throw new Error(`unterminated ${selector} block`);
}

function token(css, name) {
  const match = css.match(new RegExp(`--${name}\\s*:\\s*([^;]+);`));
  return match ? match[1].trim() : null;
}

/** Accepts hex or oklch(), so surfaces defined in oklch still resolve. */
function toHex(value, name) {
  if (!value) throw new Error(`missing token --${name}`);
  if (value.startsWith("#")) return value;
  const m = value.match(/oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
  if (!m) throw new Error(`cannot parse --${name}: ${value}`);
  const [L, C, H] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l3 = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m3 = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s3 = (L - 0.0894841775 * a - 1.29148555 * b) ** 3;
  return (
    "#" +
    [
      4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3,
      -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3,
      -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3,
    ]
      .map((v) => {
        const c = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(Math.max(v, 0), 1 / 2.4) - 0.055;
        return Math.round(Math.min(1, Math.max(0, c)) * 255)
          .toString(16)
          .padStart(2, "0");
      })
      .join("")
  );
}

const MODES = {
  light: block(":root"),
  dark: block(".dark"),
};

// -- checks --------------------------------------------------------------------

for (const [mode, css] of Object.entries(MODES)) {
  const surface = toHex(token(css, "card"), "card");
  const text = toHex(token(css, "foreground"), "foreground");
  const series = Array.from({ length: SERIES_SLOTS }, (_, i) => {
    const value = token(css, `chart-${i + 1}`);
    if (!value) throw new Error(`missing --chart-${i + 1} in ${mode}`);
    return toHex(value, `chart-${i + 1}`);
  });

  console.log(`\n=== ${mode.toUpperCase()} — surface ${surface}, text ${text} ===`);

  console.log(`\n categorical, ${SERIES_SLOTS} slots, adjacent pairs:`);
  reportChecks(validate(series, { mode, surface }));

  console.log(`\n categorical, first ${SCATTER_BUDGET} slots, ALL pairs (scatter/bubble):`);
  reportChecks(validate(series.slice(0, SCATTER_BUDGET), { mode, surface, pairs: "all" }));
  // The budget is only meaningful if the next slot up actually fails.
  const overBudget = validate(series.slice(0, SCATTER_BUDGET + 1), { mode, surface, pairs: "all" });
  if (overBudget.ok) {
    fail(
      `SCATTER_BUDGET is ${SCATTER_BUDGET}, but ${SCATTER_BUDGET + 1} slots also pass all-pairs — ` +
        `raise SERIES_BUDGET.all in lib/viz/palette.ts`,
    );
  } else {
    pass(`budget is tight: ${SCATTER_BUDGET + 1} slots fail all-pairs, as expected`);
  }

  console.log("\n matrix tints:");
  const tints = ["pos-1", "pos-2", "neg-1", "neg-2"].map((name) => ({
    name,
    hex: toHex(token(css, `matrix-${name}`), `matrix-${name}`),
  }));

  for (const { name, hex } of tints) {
    const ratio = contrast(hex, text);
    if (ratio < TEXT_CONTRAST_MIN) {
      fail(`${name} ${hex}: text contrast ${ratio.toFixed(2)}:1 below ${TEXT_CONTRAST_MIN}`);
    } else {
      pass(`${name} ${hex}: text contrast ${ratio.toFixed(2)}:1`);
    }
  }

  for (const level of [1, 2]) {
    const positive = tints.find((t) => t.name === `pos-${level}`).hex;
    const negative = tints.find((t) => t.name === `neg-${level}`).hex;
    const normal = deltaE(positive, negative);
    const worstCvd = Math.min(deltaE(positive, negative, "protan"), deltaE(positive, negative, "deutan"));
    const detail = `level ${level}: normal ΔE ${normal.toFixed(1)}, worst CVD ΔE ${worstCvd.toFixed(1)}`;
    if (normal < ARM_SEPARATION_MIN || worstCvd < ARM_SEPARATION_CVD_MIN) {
      fail(`${detail} — above/below baseline not separable (need ${ARM_SEPARATION_MIN} / ${ARM_SEPARATION_CVD_MIN})`);
    } else {
      pass(detail);
    }
  }
}

console.log(
  failures
    ? `\n✖ palette FAILED — ${failures} check${failures === 1 ? "" : "s"}\n`
    : "\n✔ palette OK — all checks pass in both modes\n",
);
process.exit(failures ? 1 : 0);
