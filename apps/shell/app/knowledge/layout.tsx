import type { Metadata } from "next";
import Link from "next/link";

const TITLE = "Knowledge — Shane";
const DESCRIPTION = "AI-powered knowledge manager with automatic classification.";
const URL = "https://shanejli.com/knowledge";

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

export default function KnowledgeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      {/*
        SHAN-531: this bar used to be a single <nav> whose last two <span>s were
        the only place the page named itself, so /knowledge served 148 kB of
        HTML containing no heading element at all — nothing in a screen
        reader's heading list, and nothing but <title> for the crawlers the
        sitemap invites here. The back link is still navigation; the element
        symbol and name are the page's <h1>.

        The classes are unchanged and Tailwind's preflight resets heading
        font-size and weight to inherit, so this is the same bar pixel for
        pixel — the flex row just moved up to the <header> and the gap-4
        between "Kn" and "Knowledge" is now the <h1>'s own.
      */}
      <header className="flex items-center gap-4 px-6 py-4 border-b border-white/8">
        <nav>
          <Link
            href="/"
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            &larr; Table
          </Link>
        </nav>
        <h1 className="flex items-center gap-4">
          {/* aria-hidden: the periodic-table symbol is a visual echo of the
              word beside it, and without this the heading announces as
              "KnKnowledge" — the two spans are adjacent inline nodes, so the
              accessible name concatenates them with no separator. */}
          <span aria-hidden="true" className="text-xl font-bold text-emerald-400">Kn</span>
          <span className="text-gray-300">Knowledge</span>
        </h1>
      </header>
      <main className="max-w-5xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
