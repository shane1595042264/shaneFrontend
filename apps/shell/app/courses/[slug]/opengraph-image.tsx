import { ImageResponse } from "next/og";
import { CATEGORY_STYLES } from "@/components/courses/category-styles";

export const alt = "Course card";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

interface CourseLite {
  title: string;
  category: string;
  difficulty: string;
  durationMinutes: number | null;
  rating: { average: number | null; count: number };
}

async function fetchCourse(slug: string): Promise<CourseLite | null> {
  try {
    const res = await fetch(`${API_URL}/api/courses/${encodeURIComponent(slug)}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return ((await res.json()) as { course: CourseLite }).course;
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
  const course = await fetchCourse(slug);
  const title = course?.title ?? "Courses";
  const styles = CATEGORY_STYLES[course?.category ?? "other"] ?? CATEGORY_STYLES.other;
  const fontSize = title.length > 60 ? 44 : title.length > 30 ? 56 : 72;

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
          background: `linear-gradient(135deg, ${styles.gradFrom} 0%, #000 55%, ${styles.gradTo} 160%)`,
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 28, letterSpacing: 6, opacity: 0.8 }}>
          SHANEJLI.COM / COURSES
        </div>
        <div style={{ display: "flex", fontSize, fontWeight: 700, lineHeight: 1.1 }}>
          {title}
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 26, opacity: 0.9 }}>
          {course && <div style={{ display: "flex" }}>{course.category}</div>}
          {course && <div style={{ display: "flex" }}>{course.difficulty}</div>}
          {course?.durationMinutes ? (
            <div style={{ display: "flex" }}>{course.durationMinutes} min</div>
          ) : null}
          {course && course.rating.count > 0 && course.rating.average !== null ? (
            <div style={{ display: "flex" }}>
              {course.rating.average.toFixed(1)} / 5 ({course.rating.count})
            </div>
          ) : null}
        </div>
      </div>
    ),
    { ...size },
  );
}
