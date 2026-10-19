"use client";

import { useMemo, useState } from "react";
import { PROVIDER_LABEL, formatUsd, type AiProvider, type UsageSummary } from "@/lib/api/ai";

/**
 * SHAN-596: tokens per day, stacked by provider.
 *
 * Categorical slots are the data-viz reference palette's dark steps, in a
 * fixed provider order (Gemini, Anthropic, OpenAI, xAI) that never changes
 * with which providers have data, so a colour always means the same
 * provider. Validated against this site's surface (#0c0e11): every adjacent
 * pair clears the CVD target (worst 8.4) and the normal-vision floor (19.8),
 * all four are over 3:1. Identity is never colour alone: the legend names
 * every provider and the tooltip names each segment.
 */
export const PROVIDER_ORDER: AiProvider[] = ["gemini", "anthropic", "openai", "xai"];
export const PROVIDER_COLOR: Record<AiProvider, string> = {
  gemini: "#3987e5",
  anthropic: "#d95926",
  openai: "#199e70",
  xai: "#c98500",
};

const HEIGHT = 160;
const PAD_TOP = 8;
const PAD_BOTTOM = 22;
const GAP = 2;

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return String(n);
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function shortDay(key: string): string {
  return new Date(`${key}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function UsageChart({ summary }: { summary: UsageSummary }) {
  const [hover, setHover] = useState<number | null>(null);

  const days = useMemo(() => {
    const byDay = new Map<string, Partial<Record<AiProvider, number>>>();
    for (const row of summary.daily) {
      const d = byDay.get(row.day) ?? {};
      d[row.provider] = (d[row.provider] ?? 0) + row.tokens;
      byDay.set(row.day, d);
    }
    const out: { key: string; parts: Partial<Record<AiProvider, number>>; total: number }[] = [];
    const today = new Date();
    for (let i = summary.days - 1; i >= 0; i--) {
      const key = dayKey(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - i)));
      const parts = byDay.get(key) ?? {};
      out.push({ key, parts, total: Object.values(parts).reduce((a, b) => a + (b ?? 0), 0) });
    }
    return out;
  }, [summary]);

  const used = PROVIDER_ORDER.filter((p) => summary.daily.some((d) => d.provider === p));
  const max = Math.max(1, ...days.map((d) => d.total));
  // A round-ish top tick so the gridlines land on readable numbers.
  const magnitude = 10 ** Math.floor(Math.log10(max));
  const top = Math.ceil(max / magnitude) * magnitude;
  const plotH = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const y = (v: number) => PAD_TOP + plotH - (v / top) * plotH;
  const slot = 100 / days.length;
  const barW = Math.min(24, Math.max(3, 640 / days.length - 4));
  const hovered = hover === null ? null : days[hover];

  if (summary.totals.calls === 0) {
    return (
      <div className="grid h-40 place-items-center rounded-xl text-sm text-gray-400 ring-1 ring-inset ring-white/[0.06]">
        No calls in this period yet. Select some text and press Explain.
      </div>
    );
  }

  return (
    <figure>
      <div className="relative" onPointerLeave={() => setHover(null)}>
        <svg viewBox={`0 0 100 ${HEIGHT}`} preserveAspectRatio="none" className="block h-40 w-full overflow-visible" role="img" aria-label="Tokens per day by provider">
          {[0.5, 1].map((f) => (
            <line key={f} x1={0} x2={100} y1={y(top * f)} y2={y(top * f)} stroke="rgb(255 255 255 / 0.06)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          ))}
          <line x1={0} x2={100} y1={y(0)} y2={y(0)} stroke="rgb(255 255 255 / 0.14)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        </svg>
        {/* Bars are HTML so their width, rounded ends and 2px gaps stay exact at
            any container width; the SVG above only draws the grid. */}
        <div className="absolute inset-x-0" style={{ top: PAD_TOP, height: plotH }}>
          {days.map((d, i) => {
            const segments = PROVIDER_ORDER.filter((p) => (d.parts[p] ?? 0) > 0);
            return (
              <div
                key={d.key}
                className="absolute bottom-0 flex h-full cursor-default items-end justify-center"
                style={{ left: `${i * slot}%`, width: `${slot}%` }}
                onPointerEnter={() => setHover(i)}
              >
                {hover === i && <div aria-hidden="true" className="absolute inset-y-0 w-full bg-white/[0.03]" />}
                <div className="relative flex flex-col-reverse" style={{ width: barW, gap: GAP, height: `${(d.total / top) * 100}%` }}>
                  {segments.map((p, si) => (
                    <div
                      key={p}
                      style={{
                        background: PROVIDER_COLOR[p],
                        flexGrow: d.parts[p],
                        flexBasis: 0,
                        minHeight: 1,
                        borderRadius: si === segments.length - 1 ? "4px 4px 0 0" : 0,
                      }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <div className="pointer-events-none absolute right-0 top-0 font-mono text-[10.5px] text-gray-400">{compact(top)}</div>
        <div className="mt-1 flex justify-between font-mono text-[10.5px] text-gray-400">
          <span>{shortDay(days[0].key)}</span>
          <span>{shortDay(days[Math.floor(days.length / 2)].key)}</span>
          <span>{shortDay(days[days.length - 1].key)}</span>
        </div>
        {hovered && hover !== null && (
          <div
            role="status"
            className="pointer-events-none absolute -top-2 z-10 w-48 -translate-y-full rounded-xl bg-gray-950/95 p-3 text-xs shadow-[0_16px_40px_-12px_rgb(0_0_0/0.8)] ring-1 ring-white/10 backdrop-blur"
            style={{ left: `clamp(0px, calc(${(hover + 0.5) * slot}% - 6rem), calc(100% - 12rem))` }}
          >
            <p className="font-medium text-gray-100">{shortDay(hovered.key)}</p>
            <p className="mt-0.5 font-mono text-gray-300">{hovered.total.toLocaleString()} tokens</p>
            <ul className="mt-2 space-y-1">
              {PROVIDER_ORDER.filter((p) => hovered.parts[p]).map((p) => (
                <li key={p} className="flex items-center justify-between gap-3 text-gray-300">
                  <span className="flex items-center gap-1.5">
                    <span aria-hidden="true" className="h-2 w-2 rounded-sm" style={{ background: PROVIDER_COLOR[p] }} />
                    {PROVIDER_LABEL[p]}
                  </span>
                  <span className="font-mono">{compact(hovered.parts[p] ?? 0)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <figcaption className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-300">
        {used.map((p) => (
          <span key={p} className="flex items-center gap-1.5">
            <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm" style={{ background: PROVIDER_COLOR[p] }} />
            {PROVIDER_LABEL[p]}
          </span>
        ))}
      </figcaption>
      <details className="mt-3 text-xs text-gray-400">
        <summary className="cursor-pointer hover:text-gray-200">Show as a table</summary>
        <table className="mt-2 w-full text-left font-mono">
          <thead>
            <tr className="text-gray-400">
              <th className="py-1 font-normal">Day</th>
              {used.map((p) => (
                <th key={p} className="py-1 font-normal">
                  {PROVIDER_LABEL[p]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days
              .filter((d) => d.total > 0)
              .map((d) => (
                <tr key={d.key} className="text-gray-300">
                  <td className="py-0.5">{d.key}</td>
                  {used.map((p) => (
                    <td key={p} className="py-0.5">
                      {(d.parts[p] ?? 0).toLocaleString()}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
        <p className="mt-2">Costs are estimates from list prices: {formatUsd(summary.totals.costMicroUsd)} in this period.</p>
      </details>
    </figure>
  );
}
