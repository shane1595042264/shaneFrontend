import { allElements } from "@/lib/element-registry";
import { PeriodicTable } from "@/components/periodic-table";

const SITE_URL = "https://shanejli.com";
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
      <div className="flex flex-col items-center justify-center px-2 py-6 sm:px-4 sm:py-10 md:px-6 md:py-16 gap-4 sm:gap-6 md:gap-10">
        <div className="text-center">
          <h1 className="text-xl sm:text-2xl md:text-4xl font-bold tracking-tight mb-1 sm:mb-2">Periodic Table of Life</h1>
          <p className="text-gray-400 text-xs sm:text-sm">Navigate the elements of Shane&apos;s digital world.</p>
        </div>
        <PeriodicTable elements={allElements} />
      </div>
    </>
  );
}
