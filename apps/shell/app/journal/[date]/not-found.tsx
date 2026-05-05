import Link from "next/link";

// Renders for `notFound()` thrown from journal/[date]/page.tsx — both
// invalid-format dates and missing past-date entries. Server component so
// Next can stream the 404 response with the right status code.
export default function JournalDateNotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <p className="text-gray-400 text-sm italic">No entry for this date.</p>
      <Link
        href="/journal"
        className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
      >
        &larr; Back to journal
      </Link>
    </div>
  );
}
