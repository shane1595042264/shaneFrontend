// apps/shell/lib/docs/cursor-doc-guard.ts
//
// BUILD-TIME GUARD. Reads lib/docs/content/*.ts and fails the build if a module
// page describes a keyset `cursor` as a bare timestamp instead of the compound
// `<iso-timestamp>_<row-id>` form the API actually emits.
//
// Why this needs a guard rather than a comment. SHAN-513 moved every
// timestamp-keyed list endpoint (trips, courses, scoreboard matches, blog posts,
// journal activity, loans, tea, rng history) onto a compound cursor, because a
// bare ISO timestamp drops rows two ways: `createdAt` is not unique, so a row
// tied with the boundary row is excluded from every later page; and the ISO form
// is millisecond-precise while the column is microsecond-precise, so anything
// inside the truncated gap is skipped too. content/conventions.ts was updated in
// that commit and says all of this correctly, including "treat cursor as
// opaque". The five per-module pages were not, and nobody noticed for four
// months, because nothing about a stale doc sentence breaks a build or a test.
//
// The drift was not cosmetic. The legacy bare-ISO form is still accepted for
// in-flight compatibility, so an agent that followed trips-api or courses-api
// got a 200 and a plausible-looking page that was quietly missing rows: the
// exact failure SHAN-513 fixed, reintroduced by the documentation of the fix.
// Three of the five pages went further and told the caller to construct the
// cursor out of a response field, directly contradicting conventions.ts.
//
// Scope note: conventions.ts is the canonical description and is exempt, since
// its whole job is to spell the format out. Every other page should defer to it
// rather than restate it, which is what the allowed markers below encode.
//
// This module uses node:fs and is imported only by next.config.ts, which the
// Node build/dev process evaluates and the serverless runtime never does. A
// violation fails `npm run build` and can never affect a production request.
import fs from "node:fs";
import path from "node:path";

/** The compound cursor, as conventions.ts writes it. */
const COMPOUND_SHAPE = "<iso-timestamp>_<row-id>";

/**
 * Tokens that name a timestamp column or a timestamp wire format. A cursor
 * described with one of these, and nothing else, is describing the pre-SHAN-513
 * shape.
 */
const TIMESTAMP_TOKENS = /\bISO\b|\bcreatedAt\b|\bpublishedAt\b|\btimestamp\b|\bdatetime\b/i;

/**
 * What makes a cursor sentence correct again: it either carries the compound
 * shape itself, or it hands the reader off to the conventions page. Either way
 * the caller learns the value is not a bare timestamp.
 *
 * `_<row-id>` (rather than the full COMPOUND_SHAPE) is what a page needs to
 * contain, so a sentence is free to write `<publishedAt>_<row-id>` if naming the
 * specific column reads better there.
 */
function deferredOrCorrect(line: string): boolean {
  return line.includes("_<row-id>") || line.includes("/docs/conventions");
}

/**
 * The bare word `cursor`, not the `nextCursor` response field.
 *
 * The distinction carries the guard's whole false-positive budget. Half the
 * endpoint tables in these docs describe a response as `{posts, nextCursor}` on
 * a line that also happens to mention `publishedAt` because that is the sort
 * order; that is a correct sentence making no claim about the cursor's format.
 * A line that says `cursor` on its own is making one.
 */
const BARE_CURSOR = /(^|[^a-zA-Z])cursor/i;

/** `cursor=<...>` query-parameter specs, and whatever is inside the brackets. */
const CURSOR_PARAM_SPEC = /cursor=<([^>]*)>/gi;

/** An ISO-8601 instant literal, e.g. inside a worked JSON response sample. */
const ISO_INSTANT = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/g;

interface Offender {
  file: string;
  line: number;
  rule: string;
  text: string;
}

function checkLine(line: string, lineNo: number, file: string, out: Offender[]): void {
  // Rule 1: a `cursor=<...>` spec whose brackets name a timestamp. Catches
  // `cursor=<createdAt ISO>` and `cursor=<ISO timestamp>`. A genuinely
  // non-timestamp cursor spec -- the journal's `cursor=YYYY-MM-DD` (no
  // brackets at all) or a version history's `cursor=<versionNum>` -- never
  // matches, which is the point: those two are not timestamps and must stay
  // documented as what they are.
  for (const match of line.matchAll(CURSOR_PARAM_SPEC)) {
    const inner = match[1];
    if (TIMESTAMP_TOKENS.test(inner) && !inner.includes("_")) {
      out.push({ file, line: lineNo, rule: "cursor=<timestamp> parameter spec", text: match[0] });
    }
  }

  // Rule 2: a bare ISO instant literal on a line that talks about a cursor --
  // i.e. a worked sample whose `nextCursor` value predates the compound form.
  // The doc says "send nextCursor back verbatim", so a sample value an agent
  // could copy has to be copyable.
  if (BARE_CURSOR.test(line) || /nextCursor/.test(line)) {
    for (const match of line.matchAll(ISO_INSTANT)) {
      const after = line.slice((match.index ?? 0) + match[0].length);
      if (!after.startsWith("_")) {
        out.push({ file, line: lineNo, rule: "bare ISO instant as a cursor value", text: match[0] });
      }
    }
  }

  // Rule 3: prose naming a timestamp column as the cursor value, without either
  // the compound shape or a pointer at conventions. This is the one that catches
  // the "cursor = the previous page's last createdAt" phrasing, which is worse
  // than a wrong format string because it is an instruction to build the broken
  // cursor by hand.
  if (BARE_CURSOR.test(line) && /\bcreatedAt\b|\bpublishedAt\b/.test(line) && !deferredOrCorrect(line)) {
    out.push({ file, line: lineNo, rule: "cursor described as a timestamp column", text: line.trim() });
  }
}

/**
 * Throws if any `content/*.ts` doc module outside `canonicalFile` describes a
 * cursor as a bare timestamp.
 *
 * Called from next.config.ts, which resolves both paths from the build's cwd.
 */
export function assertCursorDocsUseCompoundShape(contentDir: string, canonicalFile: string): void {
  if (!fs.existsSync(contentDir)) {
    throw new Error(
      `cursor-doc guard could not find ${contentDir}. It resolves from the ` +
        "build's cwd, so run next build from apps/shell.",
    );
  }

  const canonical = path.resolve(canonicalFile);
  if (!fs.existsSync(canonical)) {
    throw new Error(
      `cursor-doc guard could not find the canonical pagination page at ${canonical}.`,
    );
  }
  // The exemption below is only safe while the canonical page still spells the
  // format out. If it stops doing so, every other page is pointing at nothing
  // and this guard is quietly enforcing a link to a section that no longer
  // explains anything.
  if (!fs.readFileSync(canonical, "utf8").includes(COMPOUND_SHAPE)) {
    throw new Error(
      `cursor-doc guard expected ${path.basename(canonical)} to document the ` +
        `compound cursor as \`${COMPOUND_SHAPE}\` and it does not. Every other doc ` +
        "page defers to that section instead of restating the format, so if the " +
        "canonical description moved, point this guard at its new home; if it was " +
        "deleted, the keyset cursor is now undocumented everywhere.",
    );
  }

  const offenders: Offender[] = [];
  for (const entry of fs.readdirSync(contentDir).sort()) {
    if (!entry.endsWith(".ts")) continue;
    const full = path.join(contentDir, entry);
    if (path.resolve(full) === canonical) continue;
    const lines = fs.readFileSync(full, "utf8").split("\n");
    lines.forEach((line, i) => checkLine(line, i + 1, entry, offenders));
  }

  if (offenders.length > 0) {
    const list = offenders
      .map((o) => `${o.file}:${o.line} [${o.rule}] ${o.text.slice(0, 160)}`)
      .join("\n  ");
    throw new Error(
      "These API doc pages describe a keyset cursor as a bare timestamp, which is " +
        `the shape SHAN-513 replaced with \`${COMPOUND_SHAPE}\`:\n  ${list}\n\n` +
        "The bare form is still accepted for in-flight compatibility, so a caller " +
        "that follows the page gets a 200 and a short page rather than an error: it " +
        "silently skips rows that tied the boundary timestamp or shared its " +
        "millisecond. Fix the sentence to name the compound shape (write " +
        "`_<row-id>`), or link to [Pagination](/docs/conventions#pagination) and let " +
        "the canonical page carry the format. A cursor that genuinely is not a " +
        "timestamp is unaffected: the journal's `cursor=YYYY-MM-DD` and the version " +
        "history's `cursor=<versionNum>` never trip this.",
    );
  }
}
