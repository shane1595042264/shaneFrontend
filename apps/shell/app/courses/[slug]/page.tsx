import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CourseInteractive } from "@/components/courses/course-interactive";
import type { Course } from "@/lib/api/courses";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
const SITE_URL = "https://shanejli.com";

// Escape `<` so a title containing "</script>" cannot break out of the
// JSON-LD tag. Mirrors trips/[slug]/page.tsx.
function jsonLdSafe(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

// no-store: ratings/comments counts move constantly and the admin edits
// in place; the page is cheap (one JSON fetch).
async function fetchCourse(slug: string): Promise<Course | null> {
  const res = await fetch(`${API_URL}/api/courses/${encodeURIComponent(slug)}`, {
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load course: ${res.status}`);
  const data = (await res.json()) as { course: Course };
  const c = data.course;
  return c.coverUrl && c.coverUrl.startsWith("/")
    ? { ...c, coverUrl: `${API_URL}${c.coverUrl}` }
    : c;
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const course = await fetchCourse(slug).catch(() => null);
  if (!course) return { title: "Course not found" };
  const title = `${course.title} — Courses — Shane`;
  const description =
    course.description ?? `An interactive ${course.category} course.`;
  const url = `${SITE_URL}/courses/${slug}`;
  const ogImagePath = `/courses/${slug}/opengraph-image`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: "Shane — Periodic Table of Life",
      type: "article",
      images: [ogImagePath],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImagePath],
    },
  };
}

export default async function CoursePage({ params }: PageProps) {
  const { slug } = await params;
  const course = await fetchCourse(slug);
  if (!course) notFound();

  const courseUrl = `${SITE_URL}/courses/${slug}`;
  // Google requires hasCourseInstance or offers for Course rich results;
  // both are included. courseWorkload is an ISO-8601 duration.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Course",
    name: course.title,
    ...(course.description ? { description: course.description } : {}),
    url: courseUrl,
    provider: { "@type": "Person", name: "Shane Li", url: SITE_URL },
    ...(course.rating.count > 0 && course.rating.average !== null
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: Number(course.rating.average.toFixed(2)),
            ratingCount: course.rating.count,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
    image: {
      "@type": "ImageObject",
      url: `${SITE_URL}/courses/${slug}/opengraph-image`,
      width: 1200,
      height: 630,
    },
    hasCourseInstance: {
      "@type": "CourseInstance",
      courseMode: "online",
      ...(course.durationMinutes
        ? { courseWorkload: `PT${course.durationMinutes}M` }
        : {}),
    },
    offers: { "@type": "Offer", price: 0, priceCurrency: "USD" },
  };
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Shane", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Courses", item: `${SITE_URL}/courses` },
      { "@type": "ListItem", position: 3, name: course.title, item: courseUrl },
    ],
  };

  return (
    <div className="min-h-screen bg-black">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdSafe(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdSafe(breadcrumbJsonLd) }}
      />
      <CourseInteractive initialCourse={course} />
    </div>
  );
}
