import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  // A draft's own author is the only reader. noindex, and a self-canonical so
  // this does not inherit /blog's from app/blog/layout.tsx (SHAN-464).
  return {
    title: "Preview — Blog — Shane",
    robots: { index: false, follow: false },
    alternates: { canonical: `https://shanejli.com/blog/preview/${slug}` },
  };
}

export default function BlogPreviewLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
