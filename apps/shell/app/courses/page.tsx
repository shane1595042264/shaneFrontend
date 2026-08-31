"use client";

import { CoursesCatalog } from "@/components/courses/catalog";

// Public catalog: no AuthGate. Admin controls render only for a signed-in
// user (scoreboard pattern).
export default function CoursesPage() {
  return <CoursesCatalog />;
}
