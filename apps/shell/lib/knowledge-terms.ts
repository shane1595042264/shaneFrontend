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
 * - Case is decided per word. A word with a capital after its first letter
 *   (TLS, NgRx, MagicMock) is matched with its case; any other word ignores
 *   case, so "Telemetry" on a card still finds "telemetry" in a sentence and
 *   "OOM Killer" finds "OOM killer" (but not "oom killer").
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
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const pattern = (s: string) => escape(s).replace(/ /g, "\\s+");
const alternation = (keys: string[], toPattern: (key: string) => string = pattern) =>
  [...keys]
    .sort((a, b) => b.length - a.length)
    .map(toPattern)
    .join("|");

/** A word whose own capitals carry meaning: TLS, NgRx, MagicMock (not "Telemetry"). */
export function isCaseSensitive(word: string): boolean {
  return /\p{Lu}/u.test(word.slice(1));
}

// A word that ignores case, spelled for a case-sensitive regex: "Killer"
// becomes [kK][iI][lL][lL][eE][rR]. This is how "OOM Killer" keeps OOM's case
// and drops Killer's inside one pattern.
const caseless = (word: string) =>
  [...word]
    .map((ch) => {
      const lo = ch.toLowerCase();
      const up = ch.toUpperCase();
      if (lo === up) return escape(ch);
      return [...lo].length === 1 && [...up].length === 1 ? `[${lo}${up}]` : `(?:${escape(lo)}|${escape(up)})`;
    })
    .join("");
const mixedPattern = (term: string) =>
  term
    .split(" ")
    .map((w) => (isCaseSensitive(w) ? escape(w) : caseless(w)))
    .join("\\s+");

export function buildTermIndex(terms: KnowledgeTerm[]): TermIndex {
  const byId = new Map<string, KnowledgeTerm>();
  // Keyed by the lowercased string; the API never gives two cards strings
  // that differ only in case. `exact` keeps each term as written.
  const exact = new Map<string, { term: string; id: string }>();
  const folded = new Map<string, string>();
  const dense = new Map<string, string>();
  for (const t of terms) {
    byId.set(t.id, t);
    for (const raw of t.match) {
      const m = norm(raw);
      if (!m) continue;
      const key = m.toLowerCase();
      if (DENSE.test(m)) {
        if (!dense.has(m)) dense.set(m, t.id);
      } else if (!exact.has(key) && !folded.has(key)) {
        if (m.split(" ").some(isCaseSensitive)) exact.set(key, { term: m, id: t.id });
        else folded.set(key, t.id);
      }
    }
  }

  const spaced = (alts: string, flags: string) =>
    new RegExp(`(?<!${WORD_CHAR})(${alts})(?:'s|es|s)?(?!${WORD_CHAR})`, flags);
  const exactAlts = alternation([...exact.keys()], (key) => mixedPattern(exact.get(key)!.term));
  const passes: { re: RegExp | null; idOf: (m: string) => string | undefined }[] = [
    { re: exact.size ? spaced(exactAlts, "gu") : null, idOf: (m) => exact.get(norm(m).toLowerCase())?.id },
    { re: folded.size ? spaced(alternation([...folded.keys()]), "giu") : null, idOf: (m) => folded.get(norm(m).toLowerCase()) },
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
