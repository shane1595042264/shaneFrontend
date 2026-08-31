import { DOC_PAGES, getDocPage } from "@/lib/docs/registry";

export const revalidate = 3600;

export function generateStaticParams() {
  return DOC_PAGES.map((p) => ({ slug: p.slug }));
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const page = getDocPage(slug);
  if (!page) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return new Response(page.body, {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
}
