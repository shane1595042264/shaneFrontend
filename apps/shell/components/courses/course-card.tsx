"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { Course } from "@/lib/api/courses";
import { categoryStyle, DIFFICULTY_STYLES } from "./category-styles";
import { GeneratedCover } from "./generated-cover";
import { StarRating } from "./star-rating";

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.9 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring" as const, stiffness: 260, damping: 20 },
  },
};

export function CourseCard({ course }: { course: Course }) {
  const style = categoryStyle(course.category);
  return (
    <motion.li
      variants={cardVariants}
      whileHover={{ scale: 1.03, y: -4 }}
      whileTap={{ scale: 0.97 }}
      className="list-none"
    >
      <Link
        href={`/courses/${course.slug}`}
        className={`block overflow-hidden rounded-lg border ${style.border} bg-black/20 hover:shadow-lg hover:shadow-black/40 focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:outline-none`}
      >
        <div className="relative aspect-video">
          {course.coverUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={course.coverUrl}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <span className="absolute inset-x-0 bottom-0 p-4">
                <span className="line-clamp-2 text-xl font-bold leading-tight tracking-tight text-white drop-shadow">
                  {course.title}
                </span>
              </span>
            </>
          ) : (
            <GeneratedCover
              title={course.title}
              category={course.category}
              slug={course.slug}
            />
          )}
        </div>
        <div className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className={`rounded border px-1.5 py-0.5 ${style.border} ${style.bg} ${style.text}`}>
              {course.category}
            </span>
            <span className={`rounded border px-1.5 py-0.5 ${DIFFICULTY_STYLES[course.difficulty] ?? DIFFICULTY_STYLES.intermediate}`}>
              {course.difficulty}
            </span>
            {course.durationMinutes !== null && (
              <span className="rounded border border-white/15 px-1.5 py-0.5 text-gray-300">
                {course.durationMinutes} min
              </span>
            )}
          </div>
          {course.description && (
            <p className="line-clamp-2 text-sm text-gray-400">{course.description}</p>
          )}
          <div className="flex items-center justify-between">
            <StarRating
              average={course.rating.average}
              count={course.rating.count}
              mine={course.myStars}
              canRate={false}
            />
            <span className="text-xs tabular-nums text-gray-500">
              {course.commentCount} comment{course.commentCount === 1 ? "" : "s"}
            </span>
          </div>
        </div>
      </Link>
    </motion.li>
  );
}
