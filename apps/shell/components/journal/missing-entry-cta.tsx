"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { LoginButton } from "@/components/login-button";

interface Props {
  date: string;
  isToday: boolean;
}

export function MissingEntryCta({ date, isToday }: Props) {
  const { user, loading } = useAuth();

  if (loading) {
    return <p className="text-gray-500 text-sm italic">Loading…</p>;
  }

  if (!user) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-gray-500 text-sm italic">
          {isToday
            ? "No entry yet for today. Sign in to write one."
            : "No entry yet for this date. Sign in to write one."}
        </p>
        <LoginButton />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-gray-400 text-sm italic">
        {isToday
          ? "No entry yet for today. Be the first to write."
          : "No entry yet for this date. Be the first to write."}
      </p>
      <Link
        href={`/journal/${date}/edit?new=1`}
        className="inline-flex w-fit items-center gap-2 rounded-md bg-white px-3 py-1.5 text-sm font-medium text-black hover:bg-gray-200"
      >
        <span aria-hidden="true">✏️</span>
        Write the first version
      </Link>
    </div>
  );
}
