import type { Metadata } from "next";

// Auth-gated compose form. Also in CRAWLER_DISALLOW, but robots.txt is a
// request, not a guarantee — the noindex here is the part a crawler that
// ignores it still has to obey. The canonical is re-declared rather than
// inherited: app/blog/layout.tsx sets one for the index, and a nested route
// that does not override it would claim /blog as its own canonical (SHAN-464).
export const metadata: Metadata = {
  title: "New post — Blog — Shane",
  robots: { index: false, follow: false },
  alternates: { canonical: "https://shanejli.com/blog/new" },
};

export default function BlogNewLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
