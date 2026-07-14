import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EntryBody } from "@/components/journal/entry-body";
import { RelativeTime } from "@/lib/format-time";
import { EntryActions } from "@/components/journal/entry-actions";
import { EntryKeyboardNav } from "@/components/journal/entry-keyboard-nav";
import { ShareActions } from "@/components/journal/share-actions";
import { CommentsThread } from "@/components/journal/comments-thread";
import { EntryReactionBar } from "@/components/journal/entry-reaction-bar";
import { ActivitySidebar } from "@/components/journal/activity-sidebar";
import { readingTimeMinutes, toPlainExcerpt, countWords } from "@/lib/journal-text";
import { MissingEntryCta } from "@/components/journal/missing-entry-cta";
import { relativeDayLabel } from "@/lib/timezone";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
const JOURNAL_API_URL = process.env.NEXT_PUBLIC_JOURNAL_API_URL || API_URL;
const SITE_URL = "https://shanejli.com";

// ISR with explicit revalidation: cache the rendered detail HTML at the edge for
// 5 min for crawlers/idle traffic, but every mutation (create/append/revert and
// suggestion approve/reject/withdraw) calls revalidateJournalEntry, which fires
// revalidatePath for both this page and the /journal index — so authors see
// their writes instantly without waiting for the 5 min window to elapse.
export const revalidate = 300;

interface PageProps {
  params: Promise<{ date: string }>;
}

/** Validate YYYY-MM-DD format */
function isValidDate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !isNaN(Date.parse(date));
}

// Server-rendered "today" seed, in the site's default TZ (America/Chicago).
// Used only for the SSR "no entry yet — today" branch + the isToday metadata
// flag. The client overrides via timezone helpers when needed.
function getTodayUtcStr(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function fetchEntryServer(date: string) {
  try {
    const res = await fetch(`${JOURNAL_API_URL}/api/journal/entries/${date}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return res.json() as Promise<{
      entry: {
        id: string;
        date: string;
        authorId: string;
        status: string;
        editCount: number;
        pendingSuggestionCount: number;
        currentVersionId: string | null;
        createdAt: string;
        updatedAt: string;
      };
      author: { id: string; name: string | null; avatarUrl: string | null } | null;
      content: string;
      currentVersionNum: number;
      appends: Array<{
        id: string;
        entryId: string;
        authorId: string;
        author: { id: string; name: string | null; avatarUrl: string | null } | null;
        content: string;
        createdAt: string;
      }>;
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

// Plain-text snippet for meta description / OG / Twitter / JSON-LD. 155 chars
// fits Google's SERP description target; stripping markdown + collapsing
// newlines is required because Next.js drops description fields with raw \n.
const META_DESCRIPTION_LEN = 155;
function buildSnippet(content: string): string {
  return toPlainExcerpt(content, META_DESCRIPTION_LEN);
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

  // Match the on-page reading experience: appends contribute to the body the
  // reader sees, so the meta/OG/Twitter snippet must consider them too. Same
  // rationale as the reading-time fix in SHAN-197.
  const snippetSource = [data.content, ...data.appends.map((a) => a.content)].join("\n\n");
  const snippet = buildSnippet(snippetSource);
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
        "application/feed+json": `${SITE_URL}/journal/feed.json`,
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
  const todayChicago = getTodayUtcStr();
  const isToday = date === todayChicago;
  // Mirror the relative-day chip used by the journal index (SHAN-236) so the
  // detail header carries the same temporal anchor when arriving via RSS,
  // share link, or prev/next nav. Past 6 days the helper returns null and the
  // long-formatted date already carries the weekday.
  const relLabel = relativeDayLabel(date, todayChicago);
  const isRecentRel = relLabel === "Today" || relLabel === "Yesterday";
  const relChipClass = isRecentRel
    ? "rounded bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-blue-400"
    : "rounded bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-gray-400";

  if (!data?.entry) {
    // No entry yet — render the write-CTA for any valid date. We used to
    // notFound() for past dates, but the page is ISR-cached (revalidate=300),
    // so a 404 rendered just before midnight CDT keeps serving the URL that
    // is now "today", hiding the write CTA until the cache expires. Crawlers
    // stay away via the robots:noindex header set in generateMetadata above.
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
            {relLabel && <span className={relChipClass}>{relLabel}</span>}
          </h2>
          <MissingEntryCta date={date} isToday={isToday} />
        </article>
        {(prevDate || nextDate) && (
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
        )}
        <EntryKeyboardNav prevDate={prevDate} nextDate={nextDate} />
      </div>
    );
  }

  // Appends render on the same page, so the reader-facing "N min read"
  // estimate must cover them too — otherwise it under-reports.
  const fullContent = [data.content, ...data.appends.map((a) => a.content)].join("\n\n");

  const entryUrl = `${SITE_URL}/journal/${date}`;
  const personEntity = {
    "@type": "Person" as const,
    name: "Shane Li",
    url: SITE_URL,
  };
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    // Google's structured-data guidelines want headline to be the article
    // title only (no site branding, truncated ~110 chars) and to match the
    // visible <h2>, which is just the formatted date. Site name lives in
    // og:site_name / breadcrumb, so keep it out of here.
    headline: formatDate(date),
    description: buildSnippet(fullContent),
    inLanguage: "en-US",
    datePublished: data.entry.createdAt,
    dateModified: data.entry.updatedAt,
    // fullContent covers the primary body + every append, matching the read.
    wordCount: countWords(fullContent),
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
    <div className="mx-auto max-w-6xl px-4 md:px-8 py-6">
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

      <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0">
          <article className="pb-8">
            <h2 className="text-base font-semibold text-white/80 tracking-tight mb-3 flex items-center gap-2">
              <time dateTime={data.entry.date}>{formatDate(data.entry.date)}</time>
              {relLabel && <span className={relChipClass}>{relLabel}</span>}
              {data.entry.editCount > 0 && (
                <Link
                  href={`/journal/${data.entry.date}/history`}
                  title={`Last edited ${new Date(data.entry.updatedAt).toLocaleString()}`}
                  className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-gray-400 transition-colors hover:bg-white/10 hover:text-gray-200"
                >
                  edited
                </Link>
              )}
              <span className="ml-auto text-xs font-normal text-gray-500">
                {readingTimeMinutes(fullContent)} min read
              </span>
            </h2>
            <div className="mb-4 flex items-center gap-2 text-xs text-gray-400">
              {data.author?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={data.author.avatarUrl}
                  alt=""
                  className="h-5 w-5 rounded-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : null}
              <span className="text-gray-300">{data.author?.name?.trim() || "Anonymous"}</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <EntryActions date={data.entry.date} authorId={data.entry.authorId} />
              {data.entry.pendingSuggestionCount > 0 && (
                <Link
                  href={`/journal/${data.entry.date}/suggestions`}
                  className="rounded border border-amber-500/30 bg-amber-500/15 px-1.5 py-0.5 text-xs font-medium text-amber-200 transition-colors hover:bg-amber-500/25 hover:text-amber-100"
                >
                  {data.entry.pendingSuggestionCount} pending suggestion
                  {data.entry.pendingSuggestionCount === 1 ? "" : "s"} → review
                </Link>
              )}
            </div>
            <div className="mt-4">
              <EntryBody content={data.content} />
            </div>
            {data.appends && data.appends.length > 0 && (
              <ol className="mt-8 space-y-4 border-l border-white/10 pl-4">
                {data.appends.map((a) => (
                  <li key={a.id} id={`append-${a.id}`} className="relative scroll-mt-6">
                    <div className="mb-2 flex items-center gap-2 text-xs text-gray-500">
                      <span aria-hidden className="absolute -left-[1.125rem] top-1.5 h-2 w-2 rounded-full bg-white/20" />
                      <a
                        href={`#append-${a.id}`}
                        aria-label="Permalink to this sub-entry"
                        className="font-mono text-gray-500 transition-colors hover:text-gray-200 focus-visible:text-gray-200 focus-visible:outline-none"
                      >
                        <RelativeTime iso={a.createdAt} />
                      </a>
                      {a.author?.name?.trim() ? (
                        <span className="text-gray-600">· {a.author.name}</span>
                      ) : null}
                    </div>
                    <EntryBody content={a.content} />
                  </li>
                ))}
              </ol>
            )}
          </article>

          <div className="mt-6">
            <EntryReactionBar date={data.entry.date} />
          </div>

          <ShareActions date={data.entry.date} formattedDate={formatDate(data.entry.date)} />

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

          <CommentsThread date={data.entry.date} entryAuthorId={data.entry.authorId} />
        </div>
        <ActivitySidebar date={data.entry.date} />
      </div>
    </div>
  );
}
