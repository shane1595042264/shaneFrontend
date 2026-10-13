// apps/shell/lib/journal-toc.ts
// SHAN-571: the outline behind a journal date's table of contents.
//
// A date page is not one document. It is the entry body plus every append
// written under it through the day, each with its own timestamp, and each
// usually pasted from somewhere that opens with its own `# Title`. So the
// outline has two axes, and this module is where they meet:
//
//   level 0  the part: the entry or one append, keyed by its createdAt
//   level 1  that part's top sections
//   level 2  their subsections
//
// The markdown levels are relative to the part, not absolute. A part that opens
// with a lone `#` uses it as the part's title and its `##`s become level 1; a
// part written with `##` and `###` only gets the same shape one level down. That
// is what lets an append that is three paragraphs and an append that is a
// 23,000-character interview brief sit in the same outline without one of them
// rendering a level deeper than the other.
//
// The ids come from extractBodyHeadings() with one shared set across every
// part, so a heading repeated across appends ("1. The 3-line cheat sheet" is in
// three of 2026-10-13's) still gets an id that is unique on the page. EntryBody
// resolves its heading ids from the same `headings` arrays, so a row here and
// the heading it scrolls to agree by construction.

import { stripMarkdown } from "@/lib/journal-text";
import { extractBodyHeadings, type MarkdownHeading } from "@/lib/markdown-headings";

/** Anchor for the entry body's part row. Appends keep their `append-<id>` permalinks. */
export const ENTRY_BODY_ANCHOR = "entry-body";

/**
 * Ids the page already uses, so a heading that slugs to one of them gets a
 * suffix instead of a duplicate. `main-content` is the skip link's target in
 * app/layout.tsx; a "Main content" heading would otherwise have stolen it.
 */
const RESERVED_IDS = ["main-content", ENTRY_BODY_ANCHOR, "journal-toc"];

export interface JournalTocSection {
  id: string;
  text: string;
  /** 1 for a part's top sections, 2 for their subsections. */
  depth: 1 | 2;
}

export interface JournalTocPart {
  /** "entry" for the body, the append id otherwise. */
  key: string;
  /** Element the part row scrolls to and the scroll spy measures the part by. */
  anchorId: string;
  createdAt: string;
  timezone: string | null;
  /** The part's lone leading `#`, or its first line of prose when it has none. */
  title: string;
  /** Every anchored heading in the part, its title included. What EntryBody renders ids from. */
  headings: MarkdownHeading[];
  /** The rows nested under the part in the table of contents. */
  sections: JournalTocSection[];
}

export interface JournalTocSource {
  key: string;
  anchorId: string;
  content: string;
  createdAt: string;
  timezone?: string | null;
}

/**
 * The part's title heading: the first heading, when it is the first thing in the
 * body and every other heading sits below it. Two `#`s in one part means the
 * author is using `#` as a section level, so neither of them is a title.
 */
function titleHeading(content: string, headings: MarkdownHeading[]): MarkdownHeading | null {
  const first = headings[0];
  if (!first) return null;
  const firstTextLine = content.split("\n").findIndex((l) => l.trim() !== "") + 1;
  if (first.line !== firstTextLine) return null;
  if (headings.slice(1).some((h) => h.level <= first.level)) return null;
  return first;
}

/** First line of prose, for a part with no title heading. */
function fallbackTitle(content: string): string {
  let inFence = false;
  for (const raw of content.split("\n")) {
    if (/^\s*(```|~~~)/.test(raw)) {
      inFence = !inFence;
      continue;
    }
    if (inFence || /^\s*#{1,6}\s/.test(raw)) continue;
    const text = stripMarkdown(raw).replace(/\s+/g, " ").trim();
    if (text) return Array.from(text).length > 90 ? `${Array.from(text).slice(0, 88).join("").trimEnd()}…` : text;
  }
  return "Untitled";
}

export function buildJournalToc(sources: JournalTocSource[]): JournalTocPart[] {
  const usedIds = new Set(RESERVED_IDS);
  return sources.map((src) => {
    const headings = extractBodyHeadings(src.content, { usedIds });
    const title = titleHeading(src.content, headings);
    const rest = title ? headings.filter((h) => h !== title) : headings;
    const top = rest.reduce((min, h) => Math.min(min, h.level), 3);
    const sections: JournalTocSection[] = [];
    for (const h of rest) {
      const depth = h.level - top + 1;
      // A third tier would be an outline of the whole brief, not a way into it.
      // The heading keeps its id; it just does not get a row.
      if (depth > 2) continue;
      sections.push({ id: h.id, text: h.text, depth: depth as 1 | 2 });
    }
    return {
      key: src.key,
      anchorId: src.anchorId,
      createdAt: src.createdAt,
      timezone: src.timezone ?? null,
      title: title?.text || fallbackTitle(src.content),
      headings,
      sections,
    };
  });
}

/**
 * Whether the outline earns its space. Three rows is the floor /docs uses: an
 * entry with one append and no headings is two rows, which the page already
 * shows by scrolling.
 */
export function shouldShowJournalToc(parts: JournalTocPart[]): boolean {
  const sections = parts.reduce((n, p) => n + p.sections.length, 0);
  return (parts.length > 1 ? parts.length : 0) + sections >= 3;
}

function safeTimeZone(tz: string | null): string | undefined {
  if (!tz) return undefined;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return undefined;
  }
}

/**
 * "8:19 AM" in the zone the part was written in, which is the day the page is
 * about. A part written after midnight on a later date gets the date too
 * ("Oct 14, 12:40 AM") so the timeline does not appear to run backwards.
 */
export function formatPartTime(iso: string, tz: string | null, entryDate: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const timeZone = safeTimeZone(tz);
  const localDate = d.toLocaleDateString("en-CA", { timeZone });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone });
  if (localDate === entryDate) return time;
  const day = d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone });
  return `${day}, ${time}`;
}
