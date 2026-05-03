"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

interface Props {
  date: string;
  authorId: string;
}

export function EntryActions({ date, authorId }: Props) {
  const { user, loading } = useAuth();

  // Server-rendered placeholder + client-side hydration. History is always shown.
  return (
    <div className="flex items-center gap-3 text-sm">
      <Link
        href={`/journal/${date}/history`}
        className="text-gray-500 hover:text-gray-300 transition-colors"
      >
        History
      </Link>
      {!loading && user && user.id === authorId && (
        <Link
          href={`/journal/${date}/edit`}
          className="text-gray-500 hover:text-gray-300 transition-colors"
        >
          Edit
        </Link>
      )}
    </div>
  );
}
