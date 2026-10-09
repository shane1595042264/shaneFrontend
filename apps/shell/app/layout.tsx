import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { NavBar } from "@/components/nav-bar";
import { Providers } from "@/components/providers";
import { Aura } from "@/components/aura";

// SHAN-558: Geist replaces system-ui site-wide. next/font self-hosts the files,
// preloads them, and generates a size-adjusted fallback, so the swap does not
// move layout (CLS) and no request leaves for fonts.googleapis.com.
const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL("https://shanejli.com"),
  title: "Shane — Periodic Table of Life",
  description: "A periodic table of Shane's projects, tools, and creative work.",
  // No site-wide feed autodiscovery: the journal feeds were retired in
  // SHAN-475 when the journal went invite-only, and there is no other public
  // feed to advertise.
  //
  // No `icons:` key either, and do not add one (SHAN-548). The site had no
  // icon of any kind until then — every page load spent a console error on the
  // browser's automatic /favicon.ico request, and search results and the tab
  // strip drew a blank globe. The three files next to this one are Next's icon
  // file convention, and it emits the <link> tags for them on every route for
  // free. An `icons` key here would override the convention the same way
  // `openGraph.images` overrides the opengraph-image convention and drops its
  // extra tags (SHAN-522), so the files are the whole configuration:
  //
  //   favicon.ico    16/32/48, for the bare /favicon.ico that browsers,
  //                  crawlers and link unfurlers request without reading HTML.
  //   icon.png       192, the high-DPI tab and bookmark icon.
  //   apple-icon.png 180, the iOS home screen. Square on purpose: iOS applies
  //                  its own superellipse mask, and pre-rounding the corners
  //                  gets them rounded twice with transparent gaps.
  //
  // The mark is a periodic-table tile — "Sh" in #0a0a0a (the site background)
  // on a #2dd4bf teal-400 fill (the accent the live dots and the share card
  // already use), corner radius 22% of the icon, cap height 52%. Those two
  // numbers were tuned against the 16px raster specifically, where the whole
  // mark is ~8px of letterform: taller crowds the corners and rounder eats the
  // stem of the "h". It is filled teal rather than the dark-tile-with-teal-
  // symbol the element cards use, because a #0a0a0a tile disappears into a
  // dark tab strip and leaves the letters floating. Rasters rather than an
  // SVG: an SVG mark would have to set the type in <text>, which re-renders in
  // whatever font the consumer resolves and degrades to a blank teal square
  // where it resolves none, and the repo has no font-to-path tooling to
  // outline it with.
  openGraph: {
    title: "Shane — Periodic Table of Life",
    description: "A periodic table of Shane's projects, tools, and creative work.",
    url: "https://shanejli.com",
    siteName: "Shane — Periodic Table of Life",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Shane — Periodic Table of Life",
    description: "A periodic table of Shane's projects, tools, and creative work.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <Aura />
        <Providers>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-zinc-950 focus:outline-none focus:ring-2 focus:ring-white/40 focus:ring-offset-2 focus:ring-offset-zinc-950"
          >
            Skip to main content
          </a>
          <NavBar />
          <main id="main-content" tabIndex={-1} className="min-h-screen focus:outline-none">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
