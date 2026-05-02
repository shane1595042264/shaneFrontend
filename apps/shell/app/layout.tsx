import type { Metadata } from "next";
import "./globals.css";
import { NavBar } from "@/components/nav-bar";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  metadataBase: new URL("https://shanejli.com"),
  title: "Shane — Periodic Table of Life",
  description: "A periodic table of Shane's projects, tools, and creative work.",
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
    <html lang="en" className="dark">
      <body>
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
