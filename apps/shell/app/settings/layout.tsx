import type { Metadata } from "next";
import { SettingsAuthShell } from "./settings-auth-shell";

const TITLE = "Settings — Shane";
const DESCRIPTION = "Personal access tokens and account settings.";
const URL = "https://shanejli.com/settings";

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

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return <SettingsAuthShell>{children}</SettingsAuthShell>;
}
