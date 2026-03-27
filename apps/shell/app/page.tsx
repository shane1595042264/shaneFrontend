import { fetchElements, getDefaultElements } from "@/lib/elements";
import { PeriodicTable } from "@/components/periodic-table";

export default async function HomePage() {
  let elements;
  try {
    elements = await fetchElements();
  } catch {
    elements = getDefaultElements();
  }

  return (
    <div className="flex flex-col items-center justify-center px-2 py-6 sm:px-4 sm:py-10 md:px-6 md:py-16 gap-4 sm:gap-6 md:gap-10">
      <div className="text-center">
        <h1 className="text-xl sm:text-2xl md:text-4xl font-bold tracking-tight mb-1 sm:mb-2">Periodic Table of Life</h1>
        <p className="text-gray-400 text-xs sm:text-sm">Navigate the elements of Shane&apos;s digital world.</p>
      </div>
      <PeriodicTable elements={elements} />
    </div>
  );
}
