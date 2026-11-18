import { useEffect, useState } from "react";
import { API_URL } from "@/lib/api-url";

/**
 * SHAN-712: the knowledge base as a glossary. Every card with a definition is
 * a term (GET /api/knowledge/terms decides which strings a card answers to);
 * this compiles them into a matcher the reading surfaces run over their text
 * (lib/rehype-term-marks), so a word that has a card is underlined and opens
 * that card's definition.
 *
 * Matching rules, all in one place:
 * - A term with a capital after its first letter (TLS, NgRx, MagicMock) is
 *   matched with its case; anything else ignores case, so "Telemetry" on a
 *   card still finds "telemetry" in a sentence.
 * - A word must stand alone: no letter, digit or underscore on either side,
 *   in any script, so "inode" never fires inside "inodes_dir". An English
 *   plural or possessive ('s, s, es) is allowed after it, so "RFQs" finds the
 *   card for "RFQ".
 * - Chinese, Japanese and Korean terms have no word boundary to stand on and
 *   are matched wherever they appear.
 * - At one place in the text the longest term wins ("Data Subject Access
 *   Request" over a card for "Data").
 */

export interface KnowledgeTerm {
  id: string;
  word: string;
  match: string[];
  definition: string;
  category: string;
  language: string;
  partOfSpeech: string | null;
  pronunciation: string | null;
}

export interface TermHit {
  start: number;
  end: number;
  id: string;
}

export interface TermIndex {
  byId: ReadonlyMap<string, KnowledgeTerm>;
  /** Non-overlapping hits in `text`, in order. */
  find(text: string): TermHit[];
}

const DENSE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
const WORD_CHAR = "[\\p{L}\\p{N}_]";

const norm = (s: string) => s.replace(/\s+/g, " ").trim();
// Escaped literally, with any run of spaces allowed to wrap onto a new line.
// Only the syntax characters: with the u flag, escaping anything else (a
// hyphen, as in "df -h") is itself a syntax error.
const pattern = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+");
const alternation = (keys: string[]) =>
  [...keys]
    .sort((a, b) => b.length - a.length)
    .map(pattern)
    .join("|");

/** A term whose own capitals carry meaning: TLS, NgRx, MagicMock (not "Telemetry"). */
export function isCaseSensitive(term: string): boolean {
  return /\p{Lu}/u.test(term.slice(1));
}

export function buildTermIndex(terms: KnowledgeTerm[]): TermIndex {
  const byId = new Map<string, KnowledgeTerm>();
  const exact = new Map<string, string>();
  const folded = new Map<string, string>();
  const dense = new Map<string, string>();
  for (const t of terms) {
    byId.set(t.id, t);
    for (const raw of t.match) {
      const m = norm(raw);
      if (!m) continue;
      const [map, key] = DENSE.test(m) ? [dense, m] : isCaseSensitive(m) ? [exact, m] : [folded, m.toLowerCase()];
      if (!map.has(key)) map.set(key, t.id);
    }
  }

  const spaced = (map: Map<string, string>, flags: string) =>
    map.size ? new RegExp(`(?<!${WORD_CHAR})(${alternation([...map.keys()])})(?:'s|es|s)?(?!${WORD_CHAR})`, flags) : null;
  const passes: { re: RegExp | null; idOf: (m: string) => string | undefined }[] = [
    { re: spaced(exact, "gu"), idOf: (m) => exact.get(norm(m)) },
    { re: spaced(folded, "giu"), idOf: (m) => folded.get(norm(m).toLowerCase()) },
    { re: dense.size ? new RegExp(`(${alternation([...dense.keys()])})`, "gu") : null, idOf: (m) => dense.get(norm(m)) },
  ];

  return {
    byId,
    find(text) {
      const hits: TermHit[] = [];
      for (const { re, idOf } of passes) {
        if (!re) continue;
        for (const m of text.matchAll(re)) {
          const id = idOf(m[1]);
          if (id && m.index !== undefined) hits.push({ start: m.index, end: m.index + m[0].length, id });
        }
      }
      hits.sort((a, b) => a.start - b.start || b.end - a.end);
      const kept: TermHit[] = [];
      for (const h of hits) if (!kept.length || h.start >= kept[kept.length - 1].end) kept.push(h);
      return kept;
    },
  };
}

// One request per visit, shared by every body on every page. A failed load is
// forgotten so the next page tries again; until then nothing is underlined,
// which is exactly the page without this feature.
let pending: Promise<TermIndex | null> | null = null;

export function loadTermIndex(): Promise<TermIndex | null> {
  pending ??= fetch(`${API_URL}/api/knowledge/terms`)
    .then((r) => (r.ok ? (r.json() as Promise<{ terms?: KnowledgeTerm[] }>) : null))
    .then((d) => (Array.isArray(d?.terms) ? buildTermIndex(d.terms) : null))
    .catch(() => null)
    .then((index) => {
      if (!index) pending = null;
      return index;
    });
  return pending;
}

/**
 * The index, or null until it has loaded. Always null on the first render,
 * so a server-rendered page hydrates against the same markup it was sent and
 * the underlines arrive with the next render.
 */
export function useTermIndex(): TermIndex | null {
  const [index, setIndex] = useState<TermIndex | null>(null);
  useEffect(() => {
    let live = true;
    void loadTermIndex().then((i) => {
      if (live) setIndex(i);
    });
    return () => {
      live = false;
    };
  }, []);
  return index;
}
