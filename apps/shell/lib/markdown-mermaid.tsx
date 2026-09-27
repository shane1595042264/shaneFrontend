import type { Components } from "react-markdown";
import { MermaidDiagram } from "@/components/mermaid-diagram";
import { responsiveTableComponents } from "@/lib/markdown-table";

// hast helpers: the `pre` override inspects its single <code> child for
// language-mermaid and reroutes to MermaidDiagram. Overriding `pre` (not
// `code`) avoids rendering a <div> inside <pre>.
interface HastNode {
  type?: string;
  tagName?: string;
  value?: string;
  properties?: { className?: unknown };
  children?: HastNode[];
}

function textOf(node: HastNode): string {
  if (node.type === "text") return node.value ?? "";
  return (node.children ?? []).map(textOf).join("");
}

function mermaidChild(node: HastNode | undefined): HastNode | null {
  const child = node?.children?.find((c) => c.type === "element");
  if (!child || child.tagName !== "code") return null;
  const cls = child.properties?.className;
  const classes = Array.isArray(cls) ? cls : typeof cls === "string" ? [cls] : [];
  return classes.includes("language-mermaid") ? child : null;
}

// Journal entry bodies and their editor previews get the mermaid `pre`
// override on top of the shared responsive-table wrapper (SHAN-449).
export const markdownComponents: Components = {
  ...responsiveTableComponents,
  // SHAN-540. Every page that renders one of these bodies already owns the
  // document `<h1>` (the post header on /blog/<slug>, the element bar on a
  // journal date), so a body heading can only ever be subordinate to it. A
  // pasted document opens with its own `# Title` and used to ship a literal
  // second `<h1>` with identical text. Demoting is the fix rather than
  // dropping, because a body h1 that ISN'T the title is real content.
  // Rendered as h2 so `prose` styles it and the outline stays well-formed;
  // the leading title echo is removed upstream by stripLeadingTitleHeading.
  h1({ node, children, ...rest }) {
    return <h2 {...rest}>{children}</h2>;
  },
  pre(props) {
    const { node, children, ...rest } = props as {
      node?: HastNode;
      children?: React.ReactNode;
    } & React.HTMLAttributes<HTMLPreElement>;
    const code = mermaidChild(node);
    if (code) {
      return <MermaidDiagram code={textOf(code).trimEnd()} />;
    }
    return <pre {...rest}>{children}</pre>;
  },
};
