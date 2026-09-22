/**
 * Homepage Suspense fallback.
 *
 * It mirrors the Portfolio view (components/portfolio-view.tsx) because that
 * is what the homepage now opens on for a signed-out visitor, which is
 * everyone on a first load (SHAN-517). It used to draw a grid of squares for
 * the periodic table, and left alone it would have flashed a table-shaped
 * placeholder in front of a hero-shaped page on every cold load.
 *
 * Keep the widths and the gaps here in step with portfolio-view.tsx — the
 * point of a skeleton is that nothing moves when the real markup replaces it.
 *
 * Do not delete this file to "simplify" the boundary away: removing it was
 * measured on prod during SHAN-504 and made the intermittent cold-load React
 * #418 rate worse, not better.
 */
export default function HomeLoading() {
  return (
    <div className="flex w-full flex-col items-center">
      {/* The Portfolio / Table switch that HomeView renders above both views. */}
      <div className="mx-auto flex w-full max-w-[1100px] justify-end px-5 pt-5 sm:px-8">
        <div className="h-8 w-40 animate-pulse rounded-full bg-white/5" />
      </div>

      <div className="w-full px-5 pb-20 pt-16 sm:px-8 sm:pt-24 md:px-12">
        <div className="mx-auto flex max-w-3xl flex-col gap-16 sm:gap-20">
          <div className="flex flex-col gap-5">
            <div className="h-3 w-24 animate-pulse rounded bg-white/8" />
            <div className="flex flex-col gap-3">
              <div className="h-8 w-[85%] animate-pulse rounded bg-white/8 sm:h-12" />
              <div className="h-8 w-[70%] animate-pulse rounded bg-white/8 sm:h-12" />
            </div>
            <div className="flex flex-col gap-2">
              <div className="h-4 w-full max-w-xl animate-pulse rounded bg-white/5" />
              <div className="h-4 w-2/3 max-w-xl animate-pulse rounded bg-white/5" />
            </div>
          </div>

          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-4">
              <div className="h-3 w-28 shrink-0 animate-pulse rounded bg-white/8" />
              <div className="h-px grow bg-white/10" />
            </div>
            <div className="h-72 w-full animate-pulse rounded-2xl border border-white/10 bg-white/[0.02] sm:h-64" />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="h-[4.75rem] animate-pulse rounded-2xl border border-dashed border-white/10" />
              <div className="h-[4.75rem] animate-pulse rounded-2xl border border-dashed border-white/10" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
