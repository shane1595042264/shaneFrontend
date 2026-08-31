import type { Components } from "react-markdown";
import { MermaidDiagram } from "@/components/mermaid-diagram";

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

export const markdownComponents: Components = {
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
