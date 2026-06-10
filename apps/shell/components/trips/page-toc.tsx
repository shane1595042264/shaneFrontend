"use client";

/**
 * Google-Docs-style table of contents (SHAN-284). Sticky left sidebar
 * with jump links to the group page's sections; nested entries cover
 * user-created todo sections and itinerary country groups. Pure anchors
 * — the browser handles the jump, scroll-mt on the targets keeps the
 * headings clear of the viewport edge.
 */

export interface TocEntry {
  id: string;
  label: string;
  sub?: { id: string; label: string }[];
}

export function PageToc({ entries }: { entries: TocEntry[] }) {
  return (
    <nav
      aria-label="Table of contents"
      className="hidden lg:sticky lg:top-6 lg:block lg:self-start"
    >
      <p className="mb-2 text-[10px] font-medium uppercase tracking-widest text-gray-600">
        Contents
      </p>
      <ul className="space-y-1 border-l border-white/10">
        {entries.map((e) => (
          <li key={e.id}>
            <a
              href={`#${e.id}`}
              className="-ml-px block border-l border-transparent py-0.5 pl-3 text-xs text-gray-400 hover:border-white/40 hover:text-white"
            >
              {e.label}
            </a>
            {e.sub && e.sub.length > 0 && (
              <ul>
                {e.sub.map((s) => (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      className="-ml-px block truncate border-l border-transparent py-0.5 pl-6 text-[11px] text-gray-500 hover:border-white/40 hover:text-gray-200"
                    >
                      {s.label}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Collapsible section shell shared by the group page (SHAN-284). */
export function CollapsibleSection({
  id,
  title,
  right,
  children,
}: {
  id: string;
  title: React.ReactNode;
  /** Optional right-aligned summary content (badges, counters). */
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <details id={id} open className="group/sec mb-8 scroll-mt-6">
      <summary className="mb-2 flex cursor-pointer select-none items-baseline justify-between gap-3 text-sm font-medium text-gray-300 [&::-webkit-details-marker]:hidden">
        <span>
          <span className="mr-1.5 inline-block transition-transform group-open/sec:rotate-90">
            ›
          </span>
          {title}
        </span>
        {right}
      </summary>
      {children}
    </details>
  );
}
