import Link from "next/link";
import type { BlogPost } from "@/lib/api/blog";
import { readingTimeMinutes, toPlainExcerpt } from "@/lib/journal-text";

// Until cover images land in Phase 3, the only thing varying a tile's height is
// how much prose it shows, so the excerpt is left long (the backend already
// caps its source at 500 chars) and deliberately not line-clamped.
const EXCERPT_CHARS = 320;

// Fixed zone so the string is identical on the server and in the browser. A
// bare toLocaleDateString() would render the deploy region's date during SSR
// and the reader's on hydration, which is a React #418 mismatch.
const dateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Chicago",
  year: "numeric",
  month: "short",
  day: "numeric",
});

function formatPublished(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : dateFormatter.format(d);
}

/**
 * One masonry tile. Server Component: the index seeds its first page during
 * ISR, so crawlers get every title, excerpt and link with no JS.
 *
 * Tags render as inert spans rather than filter buttons — the whole tile is a
 * link, and nesting a button inside an anchor is invalid HTML and steals the
 * click. Tag filtering lives in the left rail.
 */
export function PostCard({ post }: { post: BlogPost }) {
  const excerpt = toPlainExcerpt(post.contentExcerpt ?? "", EXCERPT_CHARS, "…");
  const minutes = readingTimeMinutes(post.contentExcerpt ?? "");

  return (
    <article className="mb-5 break-inside-avoid">
      <Link
        href={`/blog/${post.slug}`}
        className="block rounded-lg border border-white/10 bg-white/[0.02] p-5 transition-colors hover:border-white/25 hover:bg-white/[0.05] focus-visible:border-white/40 focus-visible:outline-none"
      >
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-gray-400">
          <time dateTime={post.publishedAt}>{formatPublished(post.publishedAt)}</time>
          {minutes > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span>{minutes} min read</span>
            </>
          )}
          {post.status === "draft" && (
            <span className="rounded border border-amber-400/40 px-1.5 py-0.5 text-[10px] tracking-normal text-amber-300">
              draft
            </span>
          )}
        </div>

        <h2 className="mt-2 text-lg font-semibold leading-snug tracking-tight text-white">
          {post.title}
        </h2>

        {excerpt && <p className="mt-3 text-sm leading-relaxed text-gray-400">{excerpt}</p>}

        {post.tags.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-1.5">
            {post.tags.map((tag) => (
              <li
                key={tag}
                className="rounded border border-white/10 px-1.5 py-0.5 text-[11px] text-gray-400"
              >
                {tag}
              </li>
            ))}
          </ul>
        )}
      </Link>
    </article>
  );
}
