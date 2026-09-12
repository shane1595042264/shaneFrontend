import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  // noindex + a self-canonical, for the same reason as /blog/new: the route is
  // in CRAWLER_DISALLOW, but without an explicit canonical it would inherit
  // /blog from app/blog/layout.tsx (SHAN-464).
  return {
    title: "Edit post — Blog — Shane",
    robots: { index: false, follow: false },
    alternates: { canonical: `https://shanejli.com/blog/${slug}/edit` },
  };
}

export default function BlogEditLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
