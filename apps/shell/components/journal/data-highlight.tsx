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

const MARKER_REGEX = /\[\[data:([^|]+)\|([^|]+)\|([^\]]+)\]\]/g;

export function parseDataMarkers(text: string): Segment[] {
  const segments: Segment[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(MARKER_REGEX)) {
    const [fullMatch, type, display, rawJson] = match;
    const start = match.index!;

    if (start > lastIndex) {
      segments.push(text.slice(lastIndex, start));
    }

    segments.push({ kind: "marker", type, display, rawJson });
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
}

export function DataHighlight({ text }: DataHighlightProps) {
  const segments = parseDataMarkers(text);
  // If no markers, just return plain text
  if (segments.every((s) => typeof s === "string")) {
    return <>{text}</>;
  }

  return (
    <>
      {segments.map((seg, i) =>
        typeof seg === "string" ? (
          <span key={i}>{seg}</span>
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
        className={`inline cursor-pointer rounded px-0.5 ${style.bg} ${style.text} border-b border-dashed ${style.border} hover:opacity-80 transition-opacity focus:outline-none focus:ring-1 focus:ring-current`}
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
