import type { Metadata } from "next";
import Link from "next/link";

const TITLE = "RNG Capitalist — Shane";
const DESCRIPTION = "D20-based spending decision tool.";
const URL = "https://shanejli.com/rng-capitalist";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: URL },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: URL,
    siteName: "Shane — Periodic Table of Life",
    type: "website",
    images: ["/opengraph-image"],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/opengraph-image"],
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
