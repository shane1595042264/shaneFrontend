import type { Metadata } from "next";
import { allElements } from "@/lib/element-registry";
import { PROFILE_LINKS } from "@/lib/portfolio";
import { HomeView } from "@/components/home-view";

const SITE_URL = "https://shanejli.com";

// SHAN-518: "/" is the only public route that used to carry no title of its
// own, so it inherited the site-wide default in app/layout.tsx. That default
// describes the periodic table, and SHAN-517 made Portfolio the view a
// signed-out visitor (and every crawler that renders) actually lands on. The
// SERP title and every social unfurl therefore promised a periodic table over
// a portfolio hero. Every sibling route (/knowledge, /trips, /courses ...)
// already declares its own pair in its layout; this brings "/" in line.
//
// DESCRIPTION is 127 characters, inside Google's snippet budget, and keeps the
// words "periodic table" so the existing brand query still matches the page.
const TITLE = "Shane Li — Software Engineer";
const DESCRIPTION =
  "Selected work from Shane Li, a software engineer in Texas, plus a periodic table of the journals, trackers and tools behind it.";

// The name of the SITE, which is a different thing from the name of this page
// and is why it did not change with the rest of this ticket. Every public
// route serves this exact string as og:site_name, and Google reconciles
// WebSite.name against og:site_name and the title when it picks the site name
// to print under a SERP result. Moving one of the two in isolation would make
// them disagree, which is a weaker signal than the stale-but-consistent name.
// Renaming the site is a separate, deliberate call.
const SITE_NAME = "Shane — Periodic Table of Life";

// SHAN-464: the homepage was the one public route with no rel=canonical --
// every element segment layout sets one, but nothing did for "/". Without it
// each tracking-parameter variant (?utm_source=, ?ref=) is a separate
// indexable URL with no consolidation signal.
//
// The canonical lives here rather than in app/layout.tsx on purpose: a root
// canonical would cascade to every descendant that does not set its own
// (e.g. /blitz/connect), making them claim to be the homepage.
export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: SITE_URL,
  },
  // openGraph and twitter are replaced wholesale rather than deep-merged with
  // the parent's, so url, siteName and type are restated here.
  //
  // No `images` key on either, and that is the one place this deliberately
  // diverges from the sibling layouts. They set images: ["/opengraph-image"],
  // which collapses to a single bare og:image and drops the :alt, :type,
  // :width and :height that the file-based app/opengraph-image.tsx convention
  // emits on its own. Naming the image here would strip those off the most
  // shared URL on the site; staying silent lets the file convention keep
  // supplying the full set. (og:image:alt stays "Periodic Table of Life"
  // because the generated card genuinely depicts one.)
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: SITE_NAME,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
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
  // eligibility, disambiguation).
  //
  // SHAN-521: this used to be a literal array written out here, and the
  // Portfolio view — the page a signed-out visitor and every rendering crawler
  // actually lands on since SHAN-517 — linked none of the four. The claim had
  // no href behind it. Both now read lib/portfolio.ts, so the structured data
  // and the visible links cannot describe different sets of profiles. See that
  // file for why the list is not derived from element-registry.ts and why
  // nibbook.com is excluded.
  sameAs: PROFILE_LINKS.map((profile) => profile.url),
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": WEBSITE_ID,
  name: SITE_NAME,
  // Reads from the same const as the meta description so the structured data
  // cannot silently drift away from the tags again, which is how SHAN-518
  // happened in the first place.
  description: DESCRIPTION,
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
