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
      <nav className="flex items-center gap-4 px-6 py-4 border-b border-white/8">
        <Link href="/" className="text-sm text-gray-400 hover:text-white transition-colors">&larr; Table</Link>
        <span className="text-xl font-bold text-orange-400">Rc</span>
        <span className="text-gray-300">RNG Capitalist</span>
      </nav>
      <main className="max-w-4xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
