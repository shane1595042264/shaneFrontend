import type { Metadata } from "next";
import { allElements } from "@/lib/element-registry";
import { HomeView } from "@/components/home-view";

const SITE_URL = "https://shanejli.com";

// SHAN-464: the homepage was the one public route with no rel=canonical --
// every element segment layout sets one, but nothing did for "/". Without it
// each tracking-parameter variant (?utm_source=, ?ref=) is a separate
// indexable URL with no consolidation signal.
//
// The canonical lives here rather than in app/layout.tsx on purpose: a root
// canonical would cascade to every descendant that does not set its own
// (e.g. /blitz/connect), making them claim to be the homepage.
export const metadata: Metadata = {
  alternates: {
    canonical: SITE_URL,
  },
};
const PERSON_ID = `${SITE_URL}/#person`;
const WEBSITE_ID = `${SITE_URL}/#website`;

// Escape `<` so any future string field cannot break out of the JSON-LD <script> tag.
function jsonLdSafe(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

const personJsonLd = {
  "@context": "https://schema.org",
  "@type": "Person",
  "@id": PERSON_ID,
  name: "Shane Li",
  url: SITE_URL,
  // sameAs links the on-site Person entity to Shane's canonical profiles so
  // search engines can consolidate identity signals (Knowledge Panel
  // eligibility, disambiguation). These are the personal-profile external
  // elements already surfaced on the homepage via element-registry.ts;
  // nibbook.com is a product, not a personal identity, so it is excluded.
  sameAs: [
    "https://github.com/shane1595042264",
    "https://www.linkedin.com/in/shane-juntao-li/",
    "https://www.youtube.com/@mr.doubleplus8206",
    "https://space.bilibili.com/453338854",
  ],
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": WEBSITE_ID,
  name: "Shane — Periodic Table of Life",
  description: "A periodic table of Shane's projects, tools, and creative work.",
  url: SITE_URL,
  inLanguage: "en-US",
  publisher: { "@id": PERSON_ID },
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdSafe(personJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdSafe(websiteJsonLd) }}
      />
      {/*
        SHAN-517: the homepage now has two views. HomeView owns which one is
        showing and renders both into the server HTML — the page heading and
        the table's internal links moved in there with it, so this route stays
        a plain server component and keeps its canonical and JSON-LD.
      */}
      <HomeView elements={allElements} />
    </>
  );
}
