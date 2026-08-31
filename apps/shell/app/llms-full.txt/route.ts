import { DOC_PAGES } from "@/lib/docs/registry";

const SITE_URL = "https://shanejli.com";

export const revalidate = 3600;

export function GET() {
  const parts = DOC_PAGES.map(
    (p) => `<!-- source: ${SITE_URL}/docs/${p.slug} -->\n\n${p.body.trim()}`,
  );
  const header = `# Shane's Periodic Table of Life: full developer docs\n\nGenerated from ${SITE_URL}/docs. Index: ${SITE_URL}/llms.txt\n`;
  return new Response([header, ...parts].join("\n\n---\n\n") + "\n", {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
