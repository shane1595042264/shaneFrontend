import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Metadata } from "next";
import { DOC_PAGES, getDocPage } from "@/lib/docs/registry";

export const dynamicParams = false;

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

export default async function DocPageView({ params }: PageProps) {
  const { slug } = await params;
  // dynamicParams=false guarantees a registered slug.
  const page = getDocPage(slug)!;
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
      <article className="prose prose-invert prose-sm max-w-none prose-pre:overflow-x-auto prose-table:text-sm">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{page.body}</ReactMarkdown>
      </article>
    </main>
  );
}
