import Link from "next/link";

// Renders for `notFound()` thrown from journal/[date]/page.tsx — both
// invalid-format dates and missing past-date entries. Server component so
// Next can stream the 404 response with the right status code.
//
// SHAN-528 added the <h1>; this page, app/not-found.tsx and the five edge 404s
// in lib/edge-not-found.ts all had a bare <p> as their top-level text and so
// no heading element at all. It gets no public route list like the other two
// do: the whole /journal tree is invite-only (SHAN-475), so anyone who reaches
// this is a signed-in member with the NavBar above them, not a lost visitor
// off a stale search result.
export default function JournalDateNotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <h1 className="text-lg font-semibold text-gray-100">
        No entry for this date
      </h1>
      <p className="text-gray-400 text-sm italic">
        Nothing has been written here yet.
      </p>
      <Link
        href="/journal"
        className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
      >
        &larr; Back to journal
      </Link>
    </div>
  );
}
