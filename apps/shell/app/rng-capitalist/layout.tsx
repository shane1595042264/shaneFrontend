import type { Metadata } from "next";
import Link from "next/link";

const TITLE = "RNG Capitalist — Shane";
const DESCRIPTION = "D20-based spending decision tool.";
const URL = "https://shanejli.com/rng-capitalist";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: URL },
  // No `images` key on purpose: the opengraph-image.tsx file convention emits
  // og:image plus :alt/:type/:width/:height and a cache-busting content hash,
  // and naming the route here would collapse all of that to one bare URL. See
  // lib/og-image-guard.ts, which fails the build if it comes back.
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: URL,
    siteName: "Shane — Periodic Table of Life",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function RngLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      {/*
        SHAN-533: the same element bar, and the same fix, as
        app/knowledge/layout.tsx — see the comment there for why the <h1> lives
        in the bar and why the classes make it a visual no-op. Held back from
        SHAN-531 because /rng-capitalist is crawler-disallowed AND its three
        top-level sections were h3s, so the h1 had to arrive together with the
        h2 promotions in components/rng/{result-card,history-list,ban-list}.tsx
        or it would have traded a missing heading for a heading-order skip.
      */}
      <header className="flex items-center gap-4 px-6 py-4 border-b border-white/8">
        <nav>
          <Link href="/" className="text-sm text-gray-400 hover:text-white transition-colors">&larr; Table</Link>
        </nav>
        <h1 className="flex items-center gap-4">
          {/* aria-hidden for the same reason as /knowledge: otherwise the
              heading announces as "RcRNG Capitalist". */}
          <span aria-hidden="true" className="text-xl font-bold text-orange-400">Rc</span>
          <span className="text-gray-300">RNG Capitalist</span>
        </h1>
      </header>
      {/* SHAN-533: <div>, not <main>. app/layout.tsx already wraps {children}
          in <main id="main-content">, so this was a second main landmark
          nested inside the first — invalid HTML, and two overlapping "main"
          entries in the landmark list. app/not-found.tsx already documents
          this rule; the container classes are unchanged. */}
      <div className="max-w-4xl mx-auto px-6 py-8">{children}</div>
    </div>
  );
}
