import type { Metadata } from "next";

// Opened as a popup from Blitz's sync settings. Auth-gated and single-purpose,
// so keep it out of every index (also listed in lib/seo-routes CRAWLER_DISALLOW).
export const metadata: Metadata = {
  title: "Connect Blitz — Shane",
  description: "Sign in with Google to sync Blitz across your devices.",
  robots: { index: false, follow: false },
};

export default function BlitzConnectLayout({ children }: { children: React.ReactNode }) {
  return <main className="min-h-screen bg-black text-white">{children}</main>;
}
