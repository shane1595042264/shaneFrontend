import Link from "next/link";
import type { ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { responsiveTableComponents } from "@/lib/markdown-table";
import { MarkdownHashScroll } from "@/components/markdown-hash-scroll";
import type { Metadata } from "next";
import { DOC_PAGES, getDocPage } from "@/lib/docs/registry";
import {
  bodyHeadingId,
  extractBodyHeadings,
  nodeText,
  type MarkdownHeading,
} from "@/lib/markdown-headings";

export const dynamicParams = false;

// Below this a table of contents is just a second copy of the page.
const MIN_TOC_HEADINGS = 3;

export function generateStaticParams() {
  return DOC_PAGES.map((p) => ({ slug: p.slug }));
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = getDocPage(slug);
  if (!page) return { title: "Documentation — Shane" };
  const url = `https://shanejli.com/docs/${page.slug}`;
  return {
    title: `${page.title} — Documentation — Shane`,
    description: page.description,
    alternates: { canonical: url },
    // siteName/type match what /journal/[date], /trips/[slug] and
    // /courses/[slug] emit. The og:image and twitter:image come from the
    // sibling opengraph-image.tsx file convention, which is why `images` is
    // deliberately absent here (SHAN-456).
    openGraph: {
      title: page.title,
      description: page.description,
      url,
      siteName: "Shane — Periodic Table of Life",
      type: "article",
    },
  };
}

/**
 * SHAN-453: h2/h3 get a slug id plus a hover-revealed self-link, so a section
 * can be cited (/docs/journal-api#endpoints) and readers can discover that it
 * can be. scroll-mt keeps the target clear of the fixed site header.
 *
 * Scoped to this file on purpose: journal entries, comments and knowledge
 * entries share the markdown renderer but not this behaviour.
 *
 * SHAN-543: the id now comes from bodyHeadingId(), which keys on the heading's
 * source line rather than on its text, so two identically-worded headings in one
 * doc resolve to their own ids instead of both answering to the first one's.
 * h1 is deliberately not overridden: the body's one `#` is the page title and
 * is excluded from the heading list for that reason.
 */
function headingComponents(headings: MarkdownHeading[]): Components {
  function anchored(Tag: "h2" | "h3") {
    return function Heading({ node, children }: { node?: unknown; children?: ReactNode }) {
      const text = nodeText(node);
      const id = bodyHeadingId(headings, node, text);
      return (
        <Tag id={id} className="group scroll-mt-24">
          {children}
          {/* SHAN-542: named after the section. Every anchor on the page saying
              "Link to this section" while pointing somewhere different is the
              identical-links-same-purpose smell, and it made a screen reader's
              link list a column of identical rows. */}
          <a
            href={`#${id}`}
            aria-label={text ? `Link to section: ${text}` : "Link to this section"}
            className="ml-2 text-gray-400 no-underline opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 hover:text-gray-300"
          >
            #
          </a>
        </Tag>
      );
    };
  }
  return { h2: anchored("h2"), h3: anchored("h3") };
}

function TableOfContents({ headings }: { headings: MarkdownHeading[] }) {
  return (
    <nav
      aria-label="On this page"
      className="mb-8 rounded-lg border border-white/10 bg-black/20 p-4"
    >
      {/* A <p>, not a heading: the page's own <h1> comes from the markdown body
          below this nav, so an <h2> here would put an h2 ahead of the h1. The
          nav's aria-label carries the name for assistive tech. */}
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">On this page</p>
      <ul className="mt-2 space-y-1 text-sm">
        {headings.map((h) => (
          <li key={h.id} className={h.depth === 3 ? "pl-4" : undefined}>
            <a href={`#${h.id}`} className="text-gray-400 hover:text-white">
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default async function DocPageView({ params }: PageProps) {
  const { slug } = await params;
  // dynamicParams=false guarantees a registered slug.
  const page = getDocPage(slug)!;
  // includeH1: the body's leading `# <Title>` is the page title, not a section.
  // Every id here is unique by construction, so there is no longer a separate
  // "which of these are safe to list" step before the nav (SHAN-543).
  const headings = extractBodyHeadings(page.body, { includeH1: false });
  const index = DOC_PAGES.findIndex((p) => p.slug === page.slug);
  const prev = index > 0 ? DOC_PAGES[index - 1] : null;
  const next = index >= 0 && index < DOC_PAGES.length - 1 ? DOC_PAGES[index + 1] : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <MarkdownHashScroll />
      <nav className="mb-6 flex items-center justify-between gap-3 text-sm">
        <Link href="/docs" className="text-gray-400 hover:text-gray-300">
          &larr; Documentation
        </Link>
        <a
          href={`/docs/raw/${page.slug}`}
          className="font-mono text-xs text-gray-400 hover:text-gray-300"
        >
          raw markdown
        </a>
      </nav>
      {headings.length >= MIN_TOC_HEADINGS && <TableOfContents headings={headings} />}
      <article className="prose prose-invert prose-sm max-w-none prose-pre:overflow-x-auto prose-table:text-sm">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{ ...responsiveTableComponents, ...headingComponents(headings) }}
        >
          {page.body}
        </ReactMarkdown>
      </article>
      {(prev || next) && (
        <nav
          aria-label="Documentation pages"
          className="mt-10 flex items-stretch justify-between gap-3 border-t border-white/10 pt-6 text-sm"
        >
          {prev ? (
            <Link
              href={`/docs/${prev.slug}`}
              className="flex-1 rounded-lg border border-white/10 bg-black/20 p-3 hover:border-white/25 hover:bg-white/5"
            >
              <span className="block text-xs uppercase tracking-wider text-gray-400">
                Previous
              </span>
              <span className="mt-0.5 block font-medium text-gray-200">&larr; {prev.title}</span>
            </Link>
          ) : (
            <span className="flex-1" />
          )}
          {next ? (
            <Link
              href={`/docs/${next.slug}`}
              className="flex-1 rounded-lg border border-white/10 bg-black/20 p-3 text-right hover:border-white/25 hover:bg-white/5"
            >
              <span className="block text-xs uppercase tracking-wider text-gray-400">Next</span>
              <span className="mt-0.5 block font-medium text-gray-200">{next.title} &rarr;</span>
            </Link>
          ) : (
            <span className="flex-1" />
          )}
        </nav>
      )}
    </div>
  );
}
