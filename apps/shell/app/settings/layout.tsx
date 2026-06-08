import type { Metadata } from "next";
import { SettingsAuthShell } from "./settings-auth-shell";

const TITLE = "Settings — Shane";
const DESCRIPTION = "Personal access tokens and account settings.";
const URL = "https://shanejli.com/settings";

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

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return <SettingsAuthShell>{children}</SettingsAuthShell>;
}
