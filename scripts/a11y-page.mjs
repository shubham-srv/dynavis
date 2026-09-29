#!/usr/bin/env node
import AxeBuilder from "@axe-core/playwright"
import { chromium } from "playwright"

/**
 * Run axe against specific routes, at specific widths.
 *
 * The two existing gates each answer a different question and neither answers this one:
 * `npm run a11y` (pa11y-ci) checks a fixed list of URLs at one viewport, and `npm run e2e`
 * checks the three viewports in PLAN §7 but only the routes its specs happen to visit.
 * Neither helps when you have changed one widget and want to know about one page at 575px.
 *
 * Usage — the server must already be running (`npm run start`):
 *
 *   npm run a11y:page -- /dashboard/emea
 *   npm run a11y:page -- /dashboard/emea --width 575
 *   npm run a11y:page -- /dashboard /focus/card.attainmentRate/emea --width 375,768,1440
 *   npm run a11y:page -- /dashboard --width 575 --dark
 *
 * In Git Bash write the route without its leading slash (`dashboard/emea`): MSYS rewrites
 * anything starting with `/` into a Windows path before the script ever sees it.
 *
 * Exits non-zero if anything is found, so it can be dropped into a hook or CI step.
 */

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]
const DEFAULT_WIDTHS = [375, 768, 1440]
const BASE = process.env.BASE_URL ?? "http://localhost:3000"

function parseArgs(argv) {
  const paths = []
  let widths = DEFAULT_WIDTHS
  let dark = false
  let height = 1000

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === "--width" || arg === "-w") {
      widths = String(argv[++i] ?? "")
        .split(",")
        .map((value) => Number(value.trim()))
        .filter((value) => Number.isFinite(value) && value > 0)
    } else if (arg === "--height") {
      height = Number(argv[++i]) || height
    } else if (arg === "--dark") {
      dark = true
    } else if (arg.startsWith("-")) {
      throw new Error(`unknown flag: ${arg}`)
    } else {
      paths.push(arg.startsWith("/") ? arg : `/${arg}`)
    }
  }

  if (paths.length === 0) {
    throw new Error(
      "give at least one route, e.g. npm run a11y:page -- /dashboard/emea --width 575"
    )
  }
  if (widths.length === 0) throw new Error("--width needs at least one number")
  return { paths, widths, dark, height }
}

async function main() {
  const { paths, widths, dark, height } = parseArgs(process.argv.slice(2))

  // Fail early and clearly: a connection refused buried in a Playwright stack trace reads
  // like a broken script rather than "you forgot to start the server".
  try {
    const probe = await fetch(BASE, { method: "HEAD" })
    if (!probe.ok && probe.status >= 500) throw new Error(String(probe.status))
  } catch {
    console.error(
      `No server at ${BASE}. Start one first:\n\n  npm run build && npm run start\n`
    )
    process.exit(2)
  }

  const browser = await chromium.launch()
  let total = 0

  for (const path of paths) {
    for (const width of widths) {
      const context = await browser.newContext({
        viewport: { width, height },
        colorScheme: dark ? "dark" : "light",
      })
      const page = await context.newPage()

      const url = `${BASE}${path}`
      const response = await page.goto(url, { waitUntil: "networkidle" })

      /*
        A route that does not exist must fail, not pass.

        Next renders a 404 as a perfectly accessible page, so without this check a typo —
        or a path mangled by the shell, which Git Bash does to anything starting with `/` —
        came back as a green tick for a page nobody asked about. A tool that reports "ok"
        for the wrong URL is worse than no tool.
      */
      const status = response?.status() ?? 0
      if (status >= 400) {
        total += 1
        console.log(`  FAIL  ${path} @ ${width}px — HTTP ${status}`)
        if (/^\/[A-Za-z]:\//.test(path)) {
          console.log(
            "        That looks like a shell-mangled path. In Git Bash, drop the"
          )
          console.log(
            "        leading slash (dashboard/emea) or prefix with MSYS_NO_PATHCONV=1."
          )
        }
        await context.close()
        continue
      }

      // Widgets pick their variant from a debounced measurement, so a page inspected too
      // early is a page in its narrowest form. Wait for the layout to settle.
      await page.waitForTimeout(400)

      const results = await new AxeBuilder({ page }).withTags(WCAG).analyze()
      const label = `${path} @ ${width}px${dark ? " (dark)" : ""}`

      if (results.violations.length === 0) {
        console.log(`  ok    ${label}`)
      } else {
        total += results.violations.length
        console.log(`  FAIL  ${label}`)
        for (const violation of results.violations) {
          console.log(`        ${violation.id} — ${violation.help}`)
          for (const node of violation.nodes.slice(0, 5)) {
            console.log(`          ${node.target.join(" ")}`)
            const why = node.failureSummary?.split("\n").filter(Boolean).at(-1)
            if (why) console.log(`            ${why.trim()}`)
          }
          if (violation.nodes.length > 5) {
            console.log(`          …and ${violation.nodes.length - 5} more`)
          }
        }
      }

      await context.close()
    }
  }

  await browser.close()
  console.log(
    total === 0
      ? `\nNo violations across ${paths.length} route(s) × ${widths.length} width(s).`
      : `\n${total} violation(s).`
  )
  process.exit(total === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(2)
})
