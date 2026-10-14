import type { ReactNode } from "react";
import type { Components } from "react-markdown";
import {
  bodyHeadingId,
  headingLabelId,
  nodeText,
  type MarkdownHeading,
} from "@/lib/markdown-headings";

/**
 * SHAN-542: h2/h3 get their id plus a hover-revealed self-link, so a section can
 * be cited (/blog/all-behavioral-questions-dinp#8-a-failure) and readers can
 * discover that it can be.
 *
 * h1 is overridden too, and still renders an h2: markdownComponents demotes a
 * body h1 because the page already owns the document h1 (SHAN-540), and an
 * override that emitted <h1> here would quietly undo that.
 *
 * Built per-render from the body's own heading list. Moved out of
 * components/blog/post-body.tsx when journal entries got a table of contents
 * (SHAN-571) rather than copied: SHAN-550 found the same accessible-name bug in
 * the two copies that already existed, and lib/heading-name-guard.ts exists to
 * stop a third.
 *
 * `scrollMarginClass` is the one thing the two surfaces disagree on. /blog
 * keeps scroll-mt-24; a journal heading lands 1.5rem under the viewport top,
 * matching the append permalinks around it, so the table of contents' active
 * line sits just below it.
 */
export function anchoredHeadings(
  headings: MarkdownHeading[],
  { scrollMarginClass = "scroll-mt-24" }: { scrollMarginClass?: string } = {},
): Components {
  function anchored(Tag: "h2" | "h3") {
    return function Heading({ node, children }: { node?: unknown; children?: ReactNode }) {
      const text = nodeText(node);
      const id = bodyHeadingId(headings, node, text);
      const labelId = headingLabelId(id);
      return (
        // SHAN-550: named from the text span below, not from everything inside
        // it. The anchor's aria-label would otherwise be concatenated into this
        // heading's accessible name and every row of a screen reader's heading
        // list would read its own text twice. See headingLabelId().
        <Tag id={id} aria-labelledby={labelId} className={`group ${scrollMarginClass}`}>
          <span id={labelId}>{children}</span>
          {/* not-prose so the typography plugin leaves it alone: this body sets
              prose-a:text-blue-400 for the author's own links, and the marker is
              chrome, not one of them.

              The label names the section rather than saying "this section" on
              every heading. 25 links reading the same and pointing somewhere
              different is the identical-links-same-purpose smell, and a
              screen-reader link list of 25 identical rows is useless. */}
          {/* data-anno-skip: the "#" is page chrome, not the author's words, so
              journal inline notes (SHAN-577) leave it out of the text they
              anchor against. */}
          <a
            href={`#${id}`}
            data-anno-skip=""
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
