import manifest from "./manifest";
import { renderSectionOgCard, sectionOgAlt, type SectionOgCard } from "@/lib/section-og-card";

// This segment's own share card (SHAN-686), so a shared link no longer unfurls
// as the homepage portfolio card. Detail pages under it keep their own.
const CARD: SectionOgCard = {
  manifest,
  title: "Vocabulary",
  description: "Graph-based multilingual vocabulary system.",
};

export const alt = sectionOgAlt(CARD);
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return renderSectionOgCard(CARD);
}
