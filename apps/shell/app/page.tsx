import { fetchElements, getDefaultElements } from "@/lib/elements";
import { fetchSlotAssignments } from "@/lib/slot-assignments";
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

export default async function HomePage() {
  let elements;
  try {
    elements = await fetchElements();
  } catch {
    elements = getDefaultElements();
  }

  let initialAssignments = {};
  try {
    initialAssignments = await fetchSlotAssignments();
  } catch {
    // No saved assignments — auto-assignment will handle it
  }

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
        <PeriodicTable elements={elements} initialAssignments={initialAssignments} />
      </div>
    </>
  );
}
