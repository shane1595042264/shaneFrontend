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
        font-size and weight to inherit, so the symbol and name land on the
        same pixels they always did — the flex row just moved up to the
        <header> and the gap-4 between "Kn" and "Knowledge" is now the
        <h1>'s own. (SHAN-531 claimed the whole bar was pixel for pixel. It
        was not quite: the back link moved, which is what the className on
        the <nav> below fixes.)
      */}
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
          {/* aria-hidden: the periodic-table symbol is a visual echo of the
              word beside it, and without this the heading announces as
              "KnKnowledge" — the two spans are adjacent inline nodes, so the
              accessible name concatenates them with no separator. */}
          <span aria-hidden="true" className="text-xl font-bold text-emerald-400">Kn</span>
          <span className="text-gray-300">Knowledge</span>
        </h1>
      </header>
      {/* SHAN-533: <div>, not <main>. app/layout.tsx already wraps {children}
          in <main id="main-content">, so this was a second main landmark
          nested inside the first — invalid HTML, and two overlapping "main"
          entries in the landmark list. Spotted in this page's a11y tree while
          verifying the SHAN-531 h1 above. app/not-found.tsx already documents
          the rule; the container classes are unchanged. */}
      <div className="max-w-5xl mx-auto px-6 py-8">{children}</div>
    </div>
  );
}
