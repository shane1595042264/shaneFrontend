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

  // Close on outside click
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
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [anchorRef, onClose]);

  return (
    <div
      ref={tooltipRef}
      className={`absolute z-50 top-full left-0 mt-1 w-72 rounded-lg border ${style.border} ${style.bg} backdrop-blur-sm shadow-xl p-3 text-xs`}
      style={{ minWidth: "240px", maxWidth: "320px" }}
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
        className={`inline cursor-pointer rounded px-0.5 ${style.bg} ${style.text} border-b border-dashed ${style.border} hover:opacity-80 transition-opacity`}
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
