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
    <div className="flex flex-col items-center justify-center px-6 py-16 gap-10">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight mb-2">Periodic Table of Life</h1>
        <p className="text-gray-400 text-sm">Navigate the elements of Shane&apos;s digital world.</p>
      </div>
      <PeriodicTable elements={elements} />
    </div>
  );
}
