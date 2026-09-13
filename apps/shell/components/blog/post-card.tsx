import Link from "next/link";
import { coverSrc, type BlogPost } from "@/lib/api/blog";
import { readingTimeMinutes, toPlainExcerpt } from "@/lib/journal-text";

// Excerpt length is what varies a coverless tile's height, so it is left long
// (the backend already caps its source at 500 chars) and deliberately not
// line-clamped. A tile WITH a cover (SHAN-487) takes most of its height from
// the image, so its excerpt is trimmed back — otherwise a covered tile runs a
// whole column tall and the masonry stops interleaving.
const EXCERPT_CHARS = 320;
const EXCERPT_CHARS_WITH_COVER = 140;

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
 *
 * A draft tile links to /blog/preview/<slug> rather than /blog/<slug>: authors
 * see their own drafts in this list, and the real post URL is existence-checked
 * at the edge by an anonymous probe that cannot see a draft, so it would
 * hard-404 them (SHAN-487).
 */
export function PostCard({ post }: { post: BlogPost }) {
  const cover = coverSrc(post.coverImageUrl);
  const isDraft = post.status === "draft";
  const excerpt = toPlainExcerpt(
    post.contentExcerpt ?? "",
    cover ? EXCERPT_CHARS_WITH_COVER : EXCERPT_CHARS,
    "…"
  );
  const minutes = readingTimeMinutes(post.contentExcerpt ?? "");

  return (
    <article className="mb-5 break-inside-avoid">
      <Link
        href={isDraft ? `/blog/preview/${post.slug}` : `/blog/${post.slug}`}
        className="block overflow-hidden rounded-lg border border-white/10 bg-white/[0.02] transition-colors hover:border-white/25 hover:bg-white/[0.05] focus-visible:border-white/40 focus-visible:outline-none"
      >
        {cover && (
          // Plain <img>, not next/image: covers are served by the backend host,
          // which the image optimizer is not configured for. alt is empty on
          // purpose — the cover is decorative and the title right below it is
          // the link's accessible name.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" loading="lazy" className="h-44 w-full object-cover" />
        )}
        <div className="p-5">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-gray-400">
            <time dateTime={post.publishedAt}>{formatPublished(post.publishedAt)}</time>
            {minutes > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span>{minutes} min read</span>
              </>
            )}
            {/* Only shown once there is something to show — a "0 comments" on
                every tile is noise, and the count is denormalized precisely so
                this costs the index nothing (SHAN-488). */}
            {(post.commentCount ?? 0) > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span>
                  {post.commentCount} comment{post.commentCount === 1 ? "" : "s"}
                </span>
              </>
            )}
            {isDraft && (
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
        </div>
      </Link>
    </article>
  );
}
