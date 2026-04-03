import Link from "next/link";

export const metadata = {
  title: "Vocabulary — Shane",
  description: "Graph-based multilingual vocabulary system",
};

export default function VocabularyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <nav className="flex items-center gap-4 px-6 py-4 border-b border-white/8">
        <Link
          href="/"
          className="text-sm text-gray-400 hover:text-white transition-colors"
        >
          &larr; Table
        </Link>
        <span className="text-xl font-bold text-blue-400">Vc</span>
        <span className="text-gray-300">Vocabulary</span>
      </nav>
      <main className="max-w-5xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
