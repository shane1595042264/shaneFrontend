import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EntryRenderer } from "@/components/journal/entry-renderer";
import { EntryKeyboardNav } from "@/components/journal/entry-keyboard-nav";
import { ShareActions } from "@/components/journal/share-actions";
import { stripDataMarkers } from "@/lib/journal-text";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
const JOURNAL_API_URL = process.env.NEXT_PUBLIC_JOURNAL_API_URL || API_URL;
const SITE_URL = "https://shanejli.com";

// ISR: cache the rendered HTML at the edge for 5 min, matching the inner
// fetchEntryServer / fetchNeighbors revalidate so outer-page and upstream-API
// caches stay aligned. Past entries are de-facto immutable; today's placeholder
// is cheap to cache. Saves SSR work on every crawl/visit.
//
// generateStaticParams returning [] is what flips Next.js 15 from "force-dynamic"
// to ISR for dynamic-param routes — without it, `revalidate` alone is ignored
// and Cache-Control stays private, no-cache. dynamicParams defaults to true so
// any /journal/<yyyy-mm-dd> is still rendered on demand and cached for 300s.
export const revalidate = 300;
export async function generateStaticParams() {
  return [];
}

interface PageProps {
  params: Promise<{ date: string }>;
}

/** Validate YYYY-MM-DD format */
function isValidDate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !isNaN(Date.parse(date));
}

// UTC day — matches backend cron's getTodayDate() so "today" means the same
// thing on both sides of the API and the nightly-generation boundary.
function getTodayUtcStr(): string {
  return new Date().toISOString().slice(0, 10);
}

async function fetchEntryServer(date: string) {
  try {
    const res = await fetch(`${JOURNAL_API_URL}/api/journal/entries/${date}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return res.json() as Promise<{
      entry: { id: string; date: string; content: string; voiceProfileVersion: number | null; createdAt: string; updatedAt: string };
    }>;
  } catch {
    return null;
  }
}

async function fetchNeighbors(date: string): Promise<{ prev: string | null; next: string | null }> {
  try {
    const res = await fetch(
      `${JOURNAL_API_URL}/api/journal/entries/${date}/neighbors`,
      { next: { revalidate: 300 } }
    );
    if (!res.ok) return { prev: null, next: null };
    return (await res.json()) as { prev: string | null; next: string | null };
  } catch {
    return { prev: null, next: null };
  }
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function buildSnippet(content: string): string {
  const plain = stripDataMarkers(content);
  return plain.length > 200 ? plain.slice(0, 200).trimEnd() + "..." : plain;
}

// Escape `<` so an entry containing "</script>" cannot break out of the JSON-LD tag.
function jsonLdSafe(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { date } = await params;
  if (!isValidDate(date)) {
    return { title: "Entry Not Found — Journal — Shane" };
  }

  const data = await fetchEntryServer(date);
  if (!data?.entry) {
    if (date === getTodayUtcStr()) {
      return {
        title: "Today — Journal — Shane",
        robots: { index: false, follow: true },
      };
    }
    // Soft-404 for valid-format dates with no entry: keep the friendly fallback UI
    // but tell crawlers not to index this empty page (still let them follow links back).
    return {
      title: "Entry Not Found — Journal — Shane",
      robots: { index: false, follow: true },
    };
  }

  const snippet = buildSnippet(data.entry.content);
  const title = `${formatDate(date)} — Journal — Shane`;
  const canonicalUrl = `${SITE_URL}/journal/${date}`;
  const ogImagePath = `/journal/${date}/opengraph-image`;

  return {
    title,
    description: snippet,
    alternates: {
      canonical: canonicalUrl,
      types: {
        "application/rss+xml": `${SITE_URL}/journal/feed.xml`,
      },
    },
    openGraph: {
      title,
      description: snippet,
      type: "article",
      publishedTime: data.entry.createdAt,
      modifiedTime: data.entry.updatedAt,
      url: canonicalUrl,
      siteName: "Shane — Periodic Table of Life",
      images: [ogImagePath],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: snippet,
      images: [ogImagePath],
    },
  };
}

export default async function JournalEntryPage({ params }: PageProps) {
  const { date } = await params;

  if (!isValidDate(date)) {
    notFound();
  }

  const [data, neighbors] = await Promise.all([
    fetchEntryServer(date),
    fetchNeighbors(date),
  ]);

  const prevDate = neighbors.prev;
  const nextDate = neighbors.next;
  const isToday = date === getTodayUtcStr();

  if (!data?.entry) {
    if (isToday) {
      return (
        <div className="max-w-2xl mx-auto px-4 md:px-8 py-6">
          <Link
            href="/journal"
            className="inline-block mb-6 text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            &larr; All entries
          </Link>
          <article className="pb-8">
            <h2 className="text-base font-semibold text-white/80 tracking-tight mb-3 flex items-center gap-2">
              <time dateTime={date}>{formatDate(date)}</time>
              <span className="text-[10px] font-medium uppercase tracking-wider text-blue-400 bg-blue-500/15 px-1.5 py-0.5 rounded">
                Today
              </span>
            </h2>
            <p className="text-gray-500 text-sm italic">
              Today&apos;s entry will be generated at 11:00 PM.
            </p>
          </article>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <p className="text-gray-400 text-sm">
          No journal entry found for {formatDate(date)}.
        </p>
        <Link
          href="/journal"
          className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
        >
          &larr; Back to journal
        </Link>
      </div>
    );
  }

  const entry = {
    id: data.entry.id,
    date: data.entry.date,
    content: data.entry.content,
    voiceProfileVersion: data.entry.voiceProfileVersion ?? 0,
    createdAt: data.entry.createdAt,
    updatedAt: data.entry.updatedAt,
  };

  const entryUrl = `${SITE_URL}/journal/${date}`;
  const personEntity = {
    "@type": "Person" as const,
    name: "Shane Li",
    url: SITE_URL,
  };
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: `${formatDate(date)} — Journal — Shane`,
    description: buildSnippet(data.entry.content),
    inLanguage: "en-US",
    datePublished: data.entry.createdAt,
    dateModified: data.entry.updatedAt,
    author: personEntity,
    publisher: personEntity,
    image: {
      "@type": "ImageObject",
      url: `${SITE_URL}/journal/${date}/opengraph-image`,
      width: 1200,
      height: 630,
    },
    url: entryUrl,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": entryUrl,
    },
  };
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Shane", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Journal", item: `${SITE_URL}/journal` },
      { "@type": "ListItem", position: 3, name: formatDate(date), item: entryUrl },
    ],
  };

  return (
    <div className="max-w-2xl mx-auto px-4 md:px-8 py-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdSafe(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdSafe(breadcrumbJsonLd) }}
      />
      {/* rel=prev/next hint search engines and reader-mode tools to the entry sequence.
          React 19 hoists <link> tags rendered here into <head>. */}
      {prevDate ? (
        <link rel="prev" href={`${SITE_URL}/journal/${prevDate}`} />
      ) : null}
      {nextDate ? (
        <link rel="next" href={`${SITE_URL}/journal/${nextDate}`} />
      ) : null}
      <Link
        href="/journal"
        className="inline-block mb-6 text-sm text-gray-500 hover:text-gray-300 transition-colors print:hidden"
      >
        &larr; All entries
      </Link>
      <EntryRenderer entry={entry} isToday={isToday} />

      <ShareActions date={entry.date} formattedDate={formatDate(entry.date)} />

      {/* Print-only canonical URL footer (so a printed/PDF page is self-attributing) */}
      <p className="hidden print:block mt-8 pt-4 border-t border-gray-300 text-xs text-gray-600">
        {entryUrl}
      </p>

      {/* Prev / Next navigation */}
      <nav className="flex items-center justify-between mt-10 pt-6 border-t border-white/8 print:hidden">
        {prevDate ? (
          <Link
            href={`/journal/${prevDate}`}
            aria-keyshortcuts="ArrowLeft j"
            className="group flex items-center gap-2 text-sm text-gray-500 hover:text-gray-200 transition-colors"
          >
            <span className="group-hover:-translate-x-0.5 transition-transform">&larr;</span>
            <span>{formatDateShort(prevDate)}</span>
          </Link>
        ) : (
          <span />
        )}
        {nextDate ? (
          <Link
            href={`/journal/${nextDate}`}
            aria-keyshortcuts="ArrowRight k"
            className="group flex items-center gap-2 text-sm text-gray-500 hover:text-gray-200 transition-colors"
          >
            <span>{formatDateShort(nextDate)}</span>
            <span className="group-hover:translate-x-0.5 transition-transform">&rarr;</span>
          </Link>
        ) : (
          <span />
        )}
      </nav>
      <EntryKeyboardNav prevDate={prevDate} nextDate={nextDate} />
    </div>
  );
}
