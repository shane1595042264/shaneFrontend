import Link from "next/link";
import type { ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { responsiveTableComponents } from "@/lib/markdown-table";
import type { Metadata } from "next";
import { DOC_PAGES, getDocPage } from "@/lib/docs/registry";
import {
  docHeadingId,
  extractDocHeadings,
  tocHeadings,
  type DocHeading,
} from "@/lib/docs/headings";

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
    openGraph: { title: page.title, description: page.description, url },
  };
}

/** Plain text of a hast node -- what the heading renders as, minus any markup. */
function nodeText(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const n = node as { type?: string; value?: string; children?: unknown[] };
  if (n.type === "text") return n.value ?? "";
  return (n.children ?? []).map(nodeText).join("");
}

/**
 * SHAN-453: h2/h3 get a slug id plus a hover-revealed self-link, so a section
 * can be cited (/docs/journal-api#endpoints) and readers can discover that it
 * can be. scroll-mt keeps the target clear of the fixed site header.
 *
 * Scoped to this file on purpose: journal entries, comments and knowledge
 * entries share the markdown renderer but not this behaviour.
 */
function headingComponents(headings: DocHeading[]): Components {
  function anchored(Tag: "h2" | "h3") {
    return function Heading({ node, children }: { node?: unknown; children?: ReactNode }) {
      const id = docHeadingId(headings, nodeText(node));
      return (
        <Tag id={id} className="group scroll-mt-24">
          {children}
          <a
            href={`#${id}`}
            aria-label="Link to this section"
            className="ml-2 text-gray-600 no-underline opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 hover:text-gray-300"
          >
            #
          </a>
        </Tag>
      );
    };
  }
  return { h2: anchored("h2"), h3: anchored("h3") };
}

function TableOfContents({ headings }: { headings: DocHeading[] }) {
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
  const headings = extractDocHeadings(page.body);
  const toc = tocHeadings(headings);
  const index = DOC_PAGES.findIndex((p) => p.slug === page.slug);
  const prev = index > 0 ? DOC_PAGES[index - 1] : null;
  const next = index >= 0 && index < DOC_PAGES.length - 1 ? DOC_PAGES[index + 1] : null;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <nav className="mb-6 flex items-center justify-between gap-3 text-sm">
        <Link href="/docs" className="text-gray-500 hover:text-gray-300">
          &larr; Documentation
        </Link>
        <a
          href={`/docs/raw/${page.slug}`}
          className="font-mono text-xs text-gray-500 hover:text-gray-300"
        >
          raw markdown
        </a>
      </nav>
      {toc.length >= MIN_TOC_HEADINGS && <TableOfContents headings={toc} />}
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
              <span className="block text-xs uppercase tracking-wider text-gray-500">
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
              <span className="block text-xs uppercase tracking-wider text-gray-500">Next</span>
              <span className="mt-0.5 block font-medium text-gray-200">{next.title} &rarr;</span>
            </Link>
          ) : (
            <span className="flex-1" />
          )}
        </nav>
      )}
    </main>
  );
}
