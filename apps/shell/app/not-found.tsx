import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6">
      <div className="text-center space-y-4 max-w-md">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded bg-gray-500/20 text-gray-300 text-xl font-bold">
          ?
        </div>
        <h2 className="text-lg font-semibold text-gray-100">
          Element not found
        </h2>
        <p className="text-sm text-gray-400">
          This element doesn&apos;t exist in the periodic table yet.
        </p>
        <Link
          href="/"
          className="inline-block px-4 py-2 text-sm bg-white/10 hover:bg-white/15 text-gray-200 rounded transition-colors"
        >
          Back to Table
        </Link>
      </div>
    </div>
  );
}
