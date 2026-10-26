import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  // Only the creator and the site owner can read a private course (SHAN-617),
  // and the server cannot see it at all, so the title stays generic. noindex,
  // and a self-canonical so this does not inherit /courses's (SHAN-464).
  return {
    title: "Private course — Courses — Shane",
    robots: { index: false, follow: false },
    alternates: { canonical: `https://shanejli.com/courses/private/${slug}` },
  };
}

export default function PrivateCourseLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
