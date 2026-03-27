import Link from "next/link";

export function NavBar() {
  return (
    <nav className="flex items-center justify-between px-6 py-4 border-b border-white/10">
      <Link href="/" className="text-xl font-bold tracking-tight hover:opacity-80 transition-opacity">
        Shane.
      </Link>
      <div className="flex gap-6 text-sm text-gray-400">
        <Link href="/" className="hover:text-white transition-colors">
          Table
        </Link>
      </div>
    </nav>
  );
}
