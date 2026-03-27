import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Journal — Shane",
  description: "Shane's personal journal and daily entries.",
};

export default function JournalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <nav className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            ← Table
          </Link>
          <span className="inline-flex items-center justify-center w-7 h-7 rounded bg-blue-600 text-white text-xs font-bold">
            Jn
          </span>
          <span className="text-xl font-bold tracking-tight">Journal</span>
        </div>
      </nav>
      <div className="max-w-3xl mx-auto px-6 py-10">
        {children}
      </div>
    </div>
  );
}
