import type { ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { markdownComponents } from "@/lib/markdown-mermaid";
import {
  bodyHeadingId,
  nodeText,
  type MarkdownHeading,
} from "@/lib/markdown-headings";

/**
 * SHAN-542: h2/h3 get their id plus a hover-revealed self-link, so a section can
 * be cited (/blog/all-behavioral-questions-dinp#8-a-failure) and readers can
 * discover that it can be. scroll-mt keeps the target clear of the fixed header.
 *
 * h1 is overridden too, and still renders an h2: markdownComponents demotes a
 * body h1 because the page already owns the document h1 (SHAN-540), and an
 * override that emitted <h1> here would quietly undo that.
 *
 * Built per-render from the post's own heading list rather than shared with
 * journal entries and knowledge pages, which use the same renderer but are not
 * documents anyone deep-links into.
 */
function anchoredHeadings(headings: MarkdownHeading[]): Components {
  function anchored(Tag: "h2" | "h3") {
    return function Heading({ node, children }: { node?: unknown; children?: ReactNode }) {
      const text = nodeText(node);
      const id = bodyHeadingId(headings, node, text);
      return (
        <Tag id={id} className="group scroll-mt-24">
          {children}
          {/* not-prose so the typography plugin leaves it alone: this body sets
              prose-a:text-blue-400 for the author's own links, and the marker is
              chrome, not one of them.

              The label names the section rather than saying "this section" on
              every heading. 25 links reading the same and pointing somewhere
              different is the identical-links-same-purpose smell, and a
              screen-reader link list of 25 identical rows is useless. */}
          <a
            href={`#${id}`}
            aria-label={text ? `Link to section: ${text}` : "Link to this section"}
            className="not-prose ml-2 text-gray-400 no-underline opacity-0 transition-opacity hover:text-gray-300 focus:opacity-100 group-hover:opacity-100"
          >
            #
          </a>
        </Tag>
      );
    };
  }
  const h2 = anchored("h2");
  return { h1: h2, h2, h3: anchored("h3") };
}

/**
 * Renders a post's markdown body with GFM. Server Component (no "use client"),
 * so the prose is in the ISR-cached HTML and readable with JS off.
 *
 * This is journal's EntryBody at a long-form reading size: wider measure,
 * larger type. Kept separate rather than parameterizing EntryBody so a tweak to
 * daily-note density never silently restyles published posts. Mermaid blocks
 * still upgrade client-side through the shared markdownComponents (SHAN-439).
 *
 * Takes the body verbatim. Callers strip the echoed title first with
 * stripLeadingTitleHeading (SHAN-540) because they need the stripped text for
 * the reading time and the descriptions anyway, and doing it twice would be
 * the same work for the same answer. `headings` must come from
 * extractBodyHeadings() over that same stripped string, or the line numbers the
 * ids are keyed on will be off by however many lines were removed.
 */
export function PostBody({
  content,
  headings,
}: {
  content: string;
  headings?: MarkdownHeading[];
}) {
  const components = headings?.length
    ? { ...markdownComponents, ...anchoredHeadings(headings) }
    : markdownComponents;
  return (
    <div className="prose prose-invert prose-lg max-w-none prose-p:my-5 prose-headings:tracking-tight prose-a:text-blue-400">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content || "*(empty)*"}
      </ReactMarkdown>
    </div>
  );
}
