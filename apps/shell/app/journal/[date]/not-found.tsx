"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MissingEntryCta } from "@/components/journal/missing-entry-cta";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default function JournalDateNotFound() {
  const pathname = usePathname();
  const segment = pathname?.split("/")[2] ?? "";
  const date = DATE_RE.test(segment) ? segment : null;

  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      {date ? (
        <MissingEntryCta date={date} isToday={false} />
      ) : (
        <p className="text-sm text-gray-400">Page not found.</p>
      )}
      <Link
        href="/journal"
        className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
      >
        &larr; Back to journal
      </Link>
    </div>
  );
}
