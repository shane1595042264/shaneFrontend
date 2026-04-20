import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EntryRenderer } from "@/components/journal/entry-renderer";
import { ShareActions } from "@/components/journal/share-actions";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
const JOURNAL_API_URL = process.env.NEXT_PUBLIC_JOURNAL_API_URL || API_URL;
const SITE_URL = "https://shanejli.com";
const OG_IMAGE_URL = `${SITE_URL}/opengraph-image`;

interface PageProps {
  params: Promise<{ date: string }>;
}

/** Validate YYYY-MM-DD format */
function isValidDate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !isNaN(Date.parse(date));
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

function stripDataMarkers(text: string): string {
  return text.replace(/\[\[data:[^|]+\|([^|]+)\|[\s\S]+?\]\]/g, "$1");
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
    return { title: "Entry Not Found — Journal — Shane" };
  }

  const snippet = buildSnippet(data.entry.content);
  const title = `${formatDate(date)} — Journal — Shane`;

  return {
    title,
    description: snippet,
    openGraph: {
      title,
      description: snippet,
      type: "article",
      publishedTime: data.entry.createdAt,
      modifiedTime: data.entry.updatedAt,
      url: `${SITE_URL}/journal/${date}`,
      siteName: "Shane — Periodic Table of Life",
      images: ["/opengraph-image"],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: snippet,
      images: ["/opengraph-image"],
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

  if (!data?.entry) {
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
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: `${formatDate(date)} — Journal — Shane`,
    description: buildSnippet(data.entry.content),
    datePublished: data.entry.createdAt,
    dateModified: data.entry.updatedAt,
    author: {
      "@type": "Person",
      name: "Shane Li",
      url: SITE_URL,
    },
    image: OG_IMAGE_URL,
    url: entryUrl,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": entryUrl,
    },
  };

  return (
    <div className="max-w-2xl mx-auto px-4 md:px-8 py-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdSafe(jsonLd) }}
      />
      <Link
        href="/journal"
        className="inline-block mb-6 text-sm text-gray-500 hover:text-gray-300 transition-colors"
      >
        &larr; All entries
      </Link>
      <EntryRenderer entry={entry} />

      <ShareActions date={entry.date} formattedDate={formatDate(entry.date)} />

      {/* Prev / Next navigation */}
      <nav className="flex items-center justify-between mt-10 pt-6 border-t border-white/8">
        {prevDate ? (
          <Link
            href={`/journal/${prevDate}`}
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
            className="group flex items-center gap-2 text-sm text-gray-500 hover:text-gray-200 transition-colors"
          >
            <span>{formatDateShort(nextDate)}</span>
            <span className="group-hover:translate-x-0.5 transition-transform">&rarr;</span>
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </div>
  );
}
