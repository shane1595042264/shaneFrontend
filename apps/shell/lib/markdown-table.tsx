import type { Components } from "react-markdown";

/**
 * SHAN-449: GFM tables render as a direct child of the `prose` container, whose
 * overflow-x is visible. API-reference tables are full of long inline code
 * tokens that can't wrap, so their min-content width blows past a phone
 * viewport and drags the whole document sideways (measured at a 388px viewport:
 * /docs/journal-api scrolled to 672px, /docs/vocabulary-api to 477px,
 * /journal/2026-09-03 to 409px). Wrapping each table in its own scroll
 * container confines that overflow to the table.
 *
 * Code blocks already behave — Tailwind typography gives `pre` an
 * `overflow-x: auto` — so tables are the only unbounded markdown block.
 *
 * This lives apart from lib/markdown-mermaid so the surfaces that only need the
 * table wrapper (docs pages, comment threads, knowledge entries) don't pull the
 * MermaidDiagram client component into their bundle. Mermaid stays scoped to
 * journal entry bodies and their editor previews (SHAN-439).
 */
export const responsiveTableComponents: Components = {
  table(props) {
    const { node: _node, children, ...rest } = props;
    return (
      <div className="overflow-x-auto">
        <table {...rest}>{children}</table>
      </div>
    );
  },
};
