// llmstxt.org convention: H1, blockquote summary, sections of links.
// Links point at the raw-markdown route so agents get text, not HTML.
import { DOC_PAGES } from "@/lib/docs/registry";

const SITE_URL = "https://shanejli.com";

export const revalidate = 3600;

export function GET() {
  const lines = [
    "# Shane's Periodic Table of Life",
    "",
    "> Personal site of Shane (Juntao) Li: a periodic table of small apps (journal, courses, trips, knowledge, and more), all backed by a public JSON API. Reads are public; writes use personal access tokens.",
    "",
    `Full docs in one fetch: ${SITE_URL}/llms-full.txt`,
    "",
    "## Docs",
    "",
    ...DOC_PAGES.map(
      (p) => `- [${p.title}](${SITE_URL}/docs/raw/${p.slug}): ${p.description}`,
    ),
    "",
  ];
  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
