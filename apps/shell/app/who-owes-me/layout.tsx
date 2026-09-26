import type { Metadata } from "next";
import Link from "next/link";

const TITLE = "Who Owes Me — Shane";
const DESCRIPTION = "Track money you've lent out.";
const URL = "https://shanejli.com/who-owes-me";

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

export default function WhoOwesMeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      {/* SHAN-533: the same element bar, and the same fix, as
          app/knowledge/layout.tsx — see the comment there. This page's own
          sections in page.tsx are already h2s, so the h1 lands straight on a
          clean h1 to h2 to h3 outline with nothing else to promote. */}
      <header className="flex items-center gap-4 px-6 py-4 border-b border-white/8">
        <nav>
          <Link href="/" className="text-sm text-gray-400 hover:text-white transition-colors">
            &larr; Table
          </Link>
        </nav>
        <h1 className="flex items-center gap-4">
          {/* aria-hidden for the same reason as /knowledge: otherwise the
              heading announces as "WmWho Owes Me". */}
          <span aria-hidden="true" className="text-xl font-bold text-orange-400">Wm</span>
          <span className="text-gray-300">Who Owes Me</span>
        </h1>
      </header>
      {/* SHAN-533: <div>, not <main> — app/layout.tsx already renders
          {children} inside <main id="main-content">. See the same note in
          app/rng-capitalist/layout.tsx. */}
      <div className="max-w-4xl mx-auto px-6 py-8">{children}</div>
    </div>
  );
}
