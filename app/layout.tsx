import type { Metadata } from "next"
import { Geist_Mono, Inter } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@/lib/utils";

// A page with no <title> fails WCAG 2.4.2 (Page Titled, Level A) — caught by the
// axe gate in tests/e2e/smoke.spec.ts. Routes override `title` as they land.
export const metadata: Metadata = {
  title: {
    default: "DynaVis",
    template: "%s · DynaVis",
  },
  description: "Strategic performance dashboard for a multinational school group.",
}

const inter = Inter({subsets:['latin'],variable:'--font-sans'})

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased", fontMono.variable, "font-sans", inter.variable)}
    >
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
