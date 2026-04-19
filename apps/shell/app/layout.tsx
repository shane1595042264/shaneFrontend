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
          <NavBar />
          <main className="min-h-screen">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
