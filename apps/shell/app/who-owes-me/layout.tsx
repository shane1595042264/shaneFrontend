import Link from "next/link";

export const metadata = {
  title: "Who Owes Me — Shane",
  description: "Track money you've lent out",
};

export default function WhoOwesMeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <nav className="flex items-center gap-4 px-6 py-4 border-b border-white/8">
        <Link href="/" className="text-sm text-gray-400 hover:text-white transition-colors">
          &larr; Table
        </Link>
        <span className="text-xl font-bold text-orange-400">Wm</span>
        <span className="text-gray-300">Who Owes Me</span>
      </nav>
      <main className="max-w-4xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
