import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CourseInteractive } from "@/components/courses/course-interactive";
import type { Course } from "@/lib/api/courses";
import { API_URL } from "@/lib/api-url";

const SITE_URL = "https://shanejli.com";

// Escape `<` so a title containing "</script>" cannot break out of the
// JSON-LD tag. Mirrors trips/[slug]/page.tsx.
function jsonLdSafe(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

// SHAN-504: ISR, not cache:"no-store". The intermittent whole-root hydration
// discard (Minified React error #418) only ever reproduced on the three
// no-store routes and only when the JS chunks arrived cold, and the one thing
// those routes did that every clean route did not was render per request: the
// page-content Suspense boundary that courses/loading.tsx creates was flushed
// dehydrated and then left that way for a live backend round trip, while the
// page's JS was already running.
//
// That hypothesis was TESTED ON PROD AND REFUTED - do not retry it. ISR does
// not remove the boundary markers, it only removes the live gap: a prerendered
// page still shipped `<!--$?-->`, `<template id="B:0">` and the content in
// `<div hidden id="S:0">`. Measured in Shane's Chrome with cold-chunk hard
// reloads, confirming `x-vercel-cache: HIT` on the document from that same
// browser, the rate was 3 hits in 21 loads - indistinguishable from the 3 in
// 19 the route had while dynamic, and from the untouched /trips control's
// 1 in 6 in the same session. Serving a complete buffered document does not
// stop the discard.
//
// This route is kept on ISR anyway, on its own merits: it is the pattern
// CLAUDE.md mandates over cache:"no-store", and it replaces a per-request
// backend round trip with an edge cache hit. 300s matches blog/[slug]; every
// mutation calls revalidateCourse() so an author's edit is visible immediately
// rather than after the window.
//
// The boundary itself was then tested too, and is ALSO refuted. Deleting
// app/courses/loading.tsx made this route serve a completely flat document -
// 0 pending boundaries, 0 staging divs, 0 templates, verified on prod from
// the browser - and the rate went to 3 hits in 7 cold loads, if anything
// worse. loading.tsx was restored, since its removal only ever had value as
// an experiment. Structure is not the discriminator: a flat, edge-cached,
// title-in-head document still fires.
//
// Where SHAN-504 actually stands: /docs/[slug] is prerendered AND
// server-renders a real 7KB tree, and it is 0 in 6. What still separates this
// route is the large hydrating CLIENT subtree (CourseInteractive plus
// CourseCommentsThread, which fires a fetch and setState on mount). That, not
// the document shape, is the next thing to look at.
export const revalidate = 300;

// `export const revalidate` alone is not enough: a dynamic segment with no
// generateStaticParams is never ISR-eligible, so Next keeps marking it ƒ and
// serving Cache-Control: no-store, which is exactly the dynamic render that
// leaves the boundary dehydrated. Listing the slugs prerenders the known
// courses at build time; dynamicParams stays on (the default) so a course
// added afterwards still renders on demand and is cached from then on.
// Failing soft to [] keeps a backend blip mid-deploy from failing the build —
// the same hazard /trips/page.tsx documents.
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  try {
    const res = await fetch(`${API_URL}/api/courses?limit=100`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { courses: { slug: string }[] };
    return data.courses.map((c) => ({ slug: c.slug }));
  } catch {
    return [];
  }
}

async function fetchCourse(slug: string): Promise<Course | null> {
  const res = await fetch(`${API_URL}/api/courses/${encodeURIComponent(slug)}`, {
    next: { revalidate },
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
