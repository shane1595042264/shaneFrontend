"use client";

import { useEffect, useId, useState } from "react";

// Lazily renders a fenced mermaid block as SVG. Until the client renders
// (and always for crawlers, feeds, and JS-off), the plain code block from
// SSR stays visible, so this is pure progressive enhancement.
let initialized = false;

export function MermaidDiagram({ code }: { code: string }) {
  const reactId = useId();
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        if (!initialized) {
          mermaid.initialize({
            startOnLoad: false,
            securityLevel: "strict",
            theme: "dark",
            darkMode: true,
          });
          initialized = true;
        }
        // mermaid ids must be valid CSS selectors; useId emits colons.
        const idSafe = `mermaid-${reactId.replace(/[^a-zA-Z0-9]/g, "")}`;
        const rendered = await mermaid.render(idSafe, code);
        if (!cancelled) setSvg(rendered.svg);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "render failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, reactId]);

  if (svg) {
    return (
      <div
        className="not-prose my-4 overflow-x-auto rounded-lg border border-white/10 bg-black/20 p-4 [&_svg]:mx-auto [&_svg]:max-w-full"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    );
  }

  return (
    <>
      <pre>
        <code className="language-mermaid">{code}</code>
      </pre>
      {error && (
        <p role="note" className="not-prose -mt-2 mb-4 text-xs text-gray-500">
          Diagram failed to render: {error}
        </p>
      )}
    </>
  );
}
