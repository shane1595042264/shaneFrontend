import type { Metadata } from "next";
import Link from "next/link";

const TITLE = "Vocabulary — Shane";
const DESCRIPTION = "Graph-based multilingual vocabulary system";
const URL = "https://shanejli.com/vocabulary";

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

export default function VocabularyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      {/* SHAN-531: same shape, and the same fix, as app/knowledge/layout.tsx —
          /vocabulary served 129 kB of words with no heading element in it. See
          the comment there for why the <h1> lives in the bar rather than in the
          content, and why this is visually a no-op. */}
      <header className="flex items-center gap-4 px-6 py-4 border-b border-white/8">
        {/* flex, so this <nav> does not establish a line box of its own.
            Before the bar was restructured the <a> was the flex item
            directly and sat in its own 20px text-sm line box; an unstyled
            block <nav> inherits the 16px/24px root strut instead, which is
            4px taller and pushed the back link down ~1px. Making the nav a
            flex container hands the height back to the link. Measured on
            prod: nav 24px and link y 82 without this class, 20px and y 80.8
            with it, which is the geometry the bare <a> had before SHAN-531.
            Caught by a pixel diff of the before/after bar, not by eye. */}
        <nav className="flex">
          <Link
            href="/"
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            &larr; Table
          </Link>
        </nav>
        <h1 className="flex items-center gap-4">
          {/* aria-hidden for the same reason as /knowledge: otherwise the
              heading announces as "VcVocabulary". */}
          <span aria-hidden="true" className="text-xl font-bold text-blue-400">Vc</span>
          <span className="text-gray-300">Vocabulary</span>
        </h1>
      </header>
      {/* SHAN-533: <div>, not <main> — app/layout.tsx already renders
          {children} inside <main id="main-content">. See the same note in
          app/knowledge/layout.tsx. */}
      <div className="max-w-5xl mx-auto px-6 py-8">{children}</div>
    </div>
  );
}
