import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  // Thin utility page: real content lives on /blog/<slug>, so this is noindex
  // with a self-canonical rather than inheriting /blog's (SHAN-464).
  return {
    title: "History — Blog — Shane",
    robots: { index: false, follow: true },
    alternates: { canonical: `https://shanejli.com/blog/${slug}/history` },
  };
}

export default function BlogHistoryLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
