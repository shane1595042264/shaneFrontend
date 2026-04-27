"use client";

import { useState, useRef, useEffect } from "react";

// Parses [[data:TYPE|DISPLAY|RAW_JSON]] markers from text
// Returns an array of segments: plain string or a data marker object

export type DataMarkerType = "strava" | "github" | "location" | "calendar" | string;

export interface DataMarker {
  kind: "marker";
  type: DataMarkerType;
  display: string;
  rawJson: string;
}

type Segment = string | DataMarker;

// Anchor JSON part to {…} to prevent [\s\S]+? matching across markers when JSON contains ]]
const MARKER_REGEX = /\[\[data:([^|]+)\|([^|]*)\|(\{[\s\S]*?\})\]\]/g;

// A marker is "hollow" when its JSON describes nothing the reader can inspect
// (e.g. count=0 commits, blank calendar title). Rendering these as clickable
// links tricks the reader into clicking on a tooltip that just shows {"count":0}.
function isHollowMarkerData(type: string, data: unknown): boolean {
  if (data === null || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  const blankString = (v: unknown) => typeof v !== "string" || v.trim() === "";
  switch (type.toLowerCase()) {
    case "strava":
    case "github":
      // Quantifier types: hollow when there were zero events.
      return d.count === 0 || d.count === undefined || d.count === null;
    case "calendar":
      // Event types: hollow when there is no title (some payloads use `summary`).
      return blankString(d.title) && blankString(d.summary);
    case "location": {
      // The LLM emits at least two payload shapes for locations: the prompt
      // example {name, duration_min} and an alternate {duration_min, locations:[]}
      // it falls back to when there were no real stops. A NAMED location is
      // still hollow when both quantitative fields explicitly say "nothing".
      if (blankString(d.name)) return true;
      const dur = typeof d.duration_min === "number" ? d.duration_min : null;
      const locs = Array.isArray(d.locations) ? d.locations : null;
      return dur === 0 && locs !== null && locs.length === 0;
    }
    default:
      return false;
  }
}

export function parseDataMarkers(text: string): Segment[] {
  const segments: Segment[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(MARKER_REGEX)) {
    const [fullMatch, type, display, rawJson] = match;
    const start = match.index!;

    if (start > lastIndex) {
      segments.push(text.slice(lastIndex, start));
    }

    // Validate JSON — render display as plain text if malformed or hollow
    try {
      const parsed = JSON.parse(rawJson);
      if (isHollowMarkerData(type, parsed)) {
        segments.push(display);
      } else {
        segments.push({ kind: "marker", type, display, rawJson });
      }
    } catch {
      segments.push(display);
    }
    lastIndex = start + fullMatch.length;
  }

  if (lastIndex < text.length) {
    segments.push(text.slice(lastIndex));
  }

  return segments;
}

const TYPE_STYLES: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  strava:   { bg: "bg-green-900/40",  text: "text-green-300",  border: "border-green-700/50",  icon: "🏃" },
  github:   { bg: "bg-purple-900/40", text: "text-purple-300", border: "border-purple-700/50", icon: "⌨" },
  location: { bg: "bg-blue-900/40",   text: "text-blue-300",   border: "border-blue-700/50",   icon: "📍" },
  calendar: { bg: "bg-orange-900/40", text: "text-orange-300", border: "border-orange-700/50", icon: "📅" },
  wechat:   { bg: "bg-emerald-900/40", text: "text-emerald-300", border: "border-emerald-700/50", icon: "💬" },
  discord:  { bg: "bg-indigo-900/40",  text: "text-indigo-300",  border: "border-indigo-700/50",  icon: "🎮" },
  twitch:   { bg: "bg-violet-900/40",  text: "text-violet-300",  border: "border-violet-700/50",  icon: "📺" },
};

function getTypeStyle(type: string) {
  return (
    TYPE_STYLES[type.toLowerCase()] ?? {
      bg: "bg-gray-800/60",
      text: "text-gray-300",
      border: "border-gray-600/50",
      icon: "◆",
    }
  );
}

function formatJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

interface TooltipProps {
  marker: DataMarker;
  anchorRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
}

function DataTooltip({ marker, anchorRef, onClose }: TooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const style = getTypeStyle(marker.type);

  // Close on outside click or Escape key
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        tooltipRef.current &&
        !tooltipRef.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        anchorRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [anchorRef, onClose]);

  // Clamp tooltip position within viewport bounds
  useEffect(() => {
    const tooltip = tooltipRef.current;
    if (!tooltip) return;
    const rect = tooltip.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      tooltip.style.left = "auto";
      tooltip.style.right = "0";
    }
    if (rect.left < 0) {
      tooltip.style.left = "0";
      tooltip.style.right = "auto";
    }
  }, []);

  return (
    <div
      ref={tooltipRef}
      className={`absolute z-50 top-full left-0 mt-1 max-w-[min(18rem,90vw)] rounded-lg border ${style.border} ${style.bg} backdrop-blur-sm shadow-xl p-3 text-xs`}
    >
      <div className={`flex items-center gap-1.5 mb-2 ${style.text} font-semibold uppercase tracking-wide text-[10px]`}>
        <span>{style.icon}</span>
        <span>{marker.type}</span>
      </div>
      <pre className="text-gray-300 overflow-x-auto whitespace-pre-wrap break-all font-mono leading-relaxed">
        {formatJson(marker.rawJson)}
      </pre>
    </div>
  );
}

interface DataHighlightProps {
  text: string;
  /** Case-insensitive substring to visually highlight in plain-text segments. */
  highlightQuery?: string;
}

// Only highlight when the trimmed query has at least 2 chars (noise otherwise).
const MIN_HIGHLIGHT_LEN = 2;

/** Escape a string for safe use inside a RegExp. */
export function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Split `text` into alternating non-match / match chunks for a
 * case-insensitive search `query`. Returns an array of `{ text, match }`.
 * If the query is too short, returns the whole text as a single non-match.
 */
export function splitByMatch(
  text: string,
  query: string
): { text: string; match: boolean }[] {
  const q = query.trim();
  if (q.length < MIN_HIGHLIGHT_LEN) {
    return [{ text, match: false }];
  }
  const parts: { text: string; match: boolean }[] = [];
  const re = new RegExp(escapeRegExp(q), "gi");
  let lastIndex = 0;
  for (const m of text.matchAll(re)) {
    const start = m.index!;
    if (start > lastIndex) parts.push({ text: text.slice(lastIndex, start), match: false });
    parts.push({ text: m[0], match: true });
    lastIndex = start + m[0].length;
  }
  if (lastIndex < text.length) parts.push({ text: text.slice(lastIndex), match: false });
  return parts.length > 0 ? parts : [{ text, match: false }];
}

function renderWithHighlight(text: string, query: string | undefined): React.ReactNode {
  if (!query || query.trim().length < MIN_HIGHLIGHT_LEN) return text;
  const parts = splitByMatch(text, query);
  if (parts.length === 1 && !parts[0].match) return text;
  return parts.map((p, i) =>
    p.match ? (
      <mark key={i} className="bg-yellow-400/80 text-black rounded-sm px-0.5">
        {p.text}
      </mark>
    ) : (
      <span key={i}>{p.text}</span>
    )
  );
}

export function DataHighlight({ text, highlightQuery }: DataHighlightProps) {
  const segments = parseDataMarkers(text);
  // If no marker objects survive, render the joined segments — not the
  // original text. Hollow markers are dropped to display-only strings here,
  // so passing `text` would leak the raw `[[data:...]]` markup into the DOM.
  if (segments.every((s) => typeof s === "string")) {
    return <>{renderWithHighlight(segments.join(""), highlightQuery)}</>;
  }

  return (
    <>
      {segments.map((seg, i) =>
        typeof seg === "string" ? (
          <span key={i}>{renderWithHighlight(seg, highlightQuery)}</span>
        ) : (
          <HighlightedMarker key={i} marker={seg} />
        )
      )}
    </>
  );
}

function HighlightedMarker({ marker }: { marker: DataMarker }) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLElement | null>(null);
  const style = getTypeStyle(marker.type);

  return (
    <span className="relative inline-block">
      <span
        ref={anchorRef as React.RefObject<HTMLSpanElement>}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((v) => !v);
          }
        }}
        tabIndex={0}
        role="button"
        aria-expanded={open}
        className={`inline cursor-pointer rounded px-0.5 ${style.bg} ${style.text} border-b border-dashed ${style.border} hover:opacity-80 transition-opacity focus:outline-none focus:ring-1 focus:ring-current print:bg-transparent print:text-black print:border-0 print:cursor-auto`}
        title={`${marker.type}: ${marker.display}`}
      >
        {marker.display}
      </span>
      {open && (
        <DataTooltip
          marker={marker}
          anchorRef={anchorRef}
          onClose={() => setOpen(false)}
        />
      )}
    </span>
  );
}
