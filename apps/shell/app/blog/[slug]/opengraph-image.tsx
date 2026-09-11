import { ImageResponse } from "next/og";
import { API_URL } from "@/lib/api-url";

export const alt = "Blog post";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

interface PostLite {
  title: string;
  post: { publishedAt: string; tags: string[] };
}

async function fetchPost(slug: string): Promise<PostLite | null> {
  try {
    const res = await fetch(`${API_URL}/api/blog/posts/${encodeURIComponent(slug)}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return (await res.json()) as PostLite;
  } catch {
    return null;
  }
}

export default async function OgImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await fetchPost(slug);
  const title = data?.title ?? "Blog";
  // Long headlines have to shrink or they overflow the 630px canvas; these
  // breakpoints match the courses card.
  const fontSize = title.length > 60 ? 44 : title.length > 30 ? 56 : 72;
  const published = data
    ? new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Chicago",
        year: "numeric",
        month: "long",
        day: "numeric",
      }).format(new Date(data.post.publishedAt))
    : "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 64,
          background: "linear-gradient(135deg, #111827 0%, #000 55%, #1f2937 160%)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 28, letterSpacing: 6, opacity: 0.8 }}>
          SHANEJLI.COM / BLOG
        </div>
        <div style={{ display: "flex", fontSize, fontWeight: 700, lineHeight: 1.1 }}>
          {title}
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 26, opacity: 0.9 }}>
          {published && <div style={{ display: "flex" }}>{published}</div>}
          {data?.post.tags.slice(0, 3).map((tag) => (
            <div key={tag} style={{ display: "flex" }}>
              #{tag}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
