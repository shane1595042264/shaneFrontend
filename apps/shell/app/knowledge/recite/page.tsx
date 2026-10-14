import type { Metadata } from "next";
import { AuthGate } from "@/components/auth-gate";
import { ReciteApp } from "@/components/knowledge/recite/recite-app";

const TITLE = "Recite · Knowledge · Shane";
const DESCRIPTION = "Recite your own knowledge cards from memory, one place at a time.";
const URL = "https://shanejli.com/knowledge/recite";

// SHAN-575. Signed-in only: the deck is your cards and every attempt writes to
// them, so a signed-out visitor gets AuthGate's sign-in prompt and nothing
// else. Hence noindex here and "/knowledge/recite" in CRAWLER_DISALLOW
// (lib/seo-routes-guard.ts fails the build when an AuthGate page is missing
// from that list). The canonical and openGraph are restated because the
// /knowledge layout's would otherwise cascade down and name the browse page.
export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  robots: { index: false, follow: false },
  alternates: { canonical: URL },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: URL,
    siteName: "Shane — Periodic Table of Life",
    type: "website",
  },
};

export default function RecitePage() {
  return (
    <AuthGate>
      <ReciteApp />
    </AuthGate>
  );
}
