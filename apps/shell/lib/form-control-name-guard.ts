// apps/shell/lib/form-control-name-guard.ts
//
// BUILD-TIME GUARD. Walks app/, components/ and packages/ui/src and fails the
// build if a `<select>`, `<input>` or `<textarea>` ships without an accessible
// name.
//
// Why a guard and not just the fix. SHAN-532 was filed off a Lighthouse run
// that scored /vocabulary Accessibility 94 and Agentic Browsing 67, naming
// three unlabelled selects. The audit that ticket asked for found seven, and
// the four it had missed were not missed by accident: they live inside the
// "+ Connect" forms in vocabulary/word-detail.tsx and knowledge/entry-detail.tsx,
// which render only after a button is pressed. Lighthouse loads a page and
// scores what is in the tree, so a control behind a toggle is permanently
// invisible to it, and /knowledge scored clean the whole time it had two
// anonymous comboboxes one click away. No amount of auditing the deployed page
// finds those. Only reading the source does, which is what this module is.
//
// That is the same lesson og-image-guard.ts records for a different rule:
// SHAN-518 fixed one route and left a comment noting the siblings were still
// broken, nothing made the comment actionable, and SHAN-522 had to sweep
// seventeen files a month later. A named control is a one-attribute change; the
// expensive part is ever noticing it is missing.
//
// SHAN-539 widened it from <select> to every form control, and the reason is
// worth keeping because it is a second, sharper blind spot than the toggle one.
// The guard shipped covering selects only, and a scan with the identical parser
// then found 23 inputs and textareas with no name at all, across 16 files, two
// of them on public pages. Every single one had a placeholder and nothing else.
// A placeholder is not a name:
//
//   * The browser erases it the moment the field has content. Tab back into a
//     half-filled "Amount" box on /who-owes-me and a screen reader announces
//     the number with no hint of what it is for.
//   * Voice control cannot target a field by a name that is no longer rendered.
//   * It is the same "a value is not a name" argument this guard already made
//     about a first <option> that reads like a label, applied to the attribute
//     that fails the same way.
//
// And Lighthouse will never tell you, which is the part that let 23 of them
// accumulate through an accessibility sweep aimed at exactly this: axe-core's
// `label` rule lists `non-empty-placeholder` among its passing checks, so a
// placeholder-only input scores green. Hence `placeholder` is deliberately
// absent from the four accepted names below. Do not add it.
//
// Four things count as a name, and all four are in use in this repo, so the
// guard accepts all four rather than forcing one house style:
//
//  1. `aria-label` -- the filter selects (knowledge-browser, filter-bar) and,
//     after SHAN-539, most of the named inputs.
//  2. `aria-labelledby` -- accepted, though nothing uses it today.
//  3. A wrapping `<label>`, which names its control implicitly. Seven selects
//     rely on this (practice/new, plans/[planId], edit-course-dialog x2,
//     block-form, plan-modal x2) and every one of them is correct.
//  4. `id` + a `<label htmlFor>` elsewhere in the file (timezone-section,
//     add-word-form, the invite-link box in trips/groups/[slug]). Preferred
//     over `aria-label` when a visible label already exists, since aria-label
//     would shadow the visible text with a second string.
//
// Some inputs cannot have a name and must not be asked for one, so two
// exemptions exist. Both are narrow on purpose:
//
//  * `type` in EXEMPT_INPUT_TYPES: submit/button/reset take their name from
//    their value, and hidden/image are not in the accessibility tree as text
//    fields. A bare `<input>` with no `type` defaults to text and is NOT
//    exempt, which is how seven of the SHAN-539 offenders were written.
//  * `aria-hidden="true"`: the markdown editor's `<input type="file">` is a
//    click target for the toolbar's image button, held out of the tree with
//    tabIndex={-1}. Naming it would put a stray "file upload" in the tree.
//
// The scanner below is deliberately more careful than a grep, because the first
// pass at the select audit used a grep and got 14 of 16 answers wrong. Both
// failure modes are encoded as tests of their own logic:
//
//  * An opening-tag regex that stops at the first ">" truncates the tag at the
//    arrow in `onChange={(e) => ...}`, hiding any attribute written after it.
//    Both who-owes-me currency selects already had `aria-label` and were
//    reported as offenders. Hence openingTag() tracks brace depth and string
//    literals and refuses a ">" preceded by "=".
//  * `<select>` written in prose inside a `//` comment is not markup.
//    knowledge-browser.tsx mentions "the location <select>" twice, and this
//    file is now full of `<input>` in prose. Hence the comment strip, which
//    runs before anything else.
//
// This module uses node:fs and is imported only by next.config.ts, which the
// Node build/dev process evaluates and the serverless runtime never does. A
// violation fails `npm run build` and can never affect a production request.
import fs from "node:fs";
import path from "node:path";

/** Tags this guard requires a name on. */
const GUARDED_TAGS = ["select", "input", "textarea"] as const;

/**
 * `<input type>` values that either carry their own name (a button's value) or
 * are not a labellable field at all. Anything outside this set, including a
 * missing `type` and a dynamic `type={...}`, needs a name.
 */
const EXEMPT_INPUT_TYPES = new Set(["hidden", "submit", "button", "reset", "image"]);

/**
 * Same two-step as lib/og-image-guard.ts and lib/seo-routes-guard.ts: block
 * comments first, then line comments only where the `//` is not preceded by a
 * colon, so an `https://` inside a string literal does not truncate its line.
 *
 * Replacing comments with an equal run of newlines rather than "" keeps every
 * subsequent line number intact, which matters here because the error message
 * reports `file:line` for a human to open.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (block) => "\n".repeat((block.match(/\n/g) || []).length))
    .split("\n")
    .map((line) => line.replace(/(^|[^:])\/\/.*$/, "$1"))
    .join("\n");
}

/**
 * Returns the full opening tag starting at `source[start] === "<"`.
 *
 * Skips over string literals (so a ">" inside a className cannot end the tag)
 * and counts `{}` depth (so a ">" inside an expression container cannot
 * either). The `!== "="` check is what saves the arrow functions: `=>` at brace
 * depth 0 never happens in valid JSX, but `(e) => ...` inside an attribute
 * does, and a caller that has already mis-tracked depth should still not split
 * an arrow.
 */
function openingTag(source: string, start: number): string {
  let depth = 0;
  for (let i = start + 1; i < source.length; i += 1) {
    const char = source[i];
    if (char === '"' || char === "'" || char === "`") {
      i += 1;
      while (i < source.length && source[i] !== char) {
        if (source[i] === "\\") i += 1;
        i += 1;
      }
    } else if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
    } else if (char === ">" && depth === 0 && source[i - 1] !== "=") {
      return source.slice(start, i + 1);
    }
  }
  // Unterminated tag: hand back a bounded slice so the caller still decides
  // something rather than scanning the rest of the file per match.
  return source.slice(start, start + 600);
}

/**
 * True when an unclosed `<label>` encloses the offset, i.e. the control is
 * implicitly named. Counts `<label` openings against `</label>` closings before
 * the offset; a self-closing `<label/>` (never used here, but cheap to respect)
 * opens nothing.
 */
function insideLabel(source: string, offset: number): boolean {
  const before = source.slice(0, offset);
  let depth = 0;
  for (const match of before.matchAll(/<label\b|<\/label>/g)) {
    if (match[0] === "</label>") {
      depth -= 1;
    } else if (!openingTag(before, match.index).trimEnd().endsWith("/>")) {
      depth += 1;
    }
  }
  return depth > 0;
}

/**
 * True when the tag's `id` is claimed by a `<label htmlFor>` in the same file.
 *
 * Template-literal ids are compared whole against the identical interpolation
 * in the htmlFor, e.g. `id={`invite-${slug}`}` against
 * ``htmlFor={`invite-${slug}`}``. SHAN-539 fixed a false negative here: the
 * first version pulled a "static suffix" out of the template by splitting on
 * "}" and taking the last part, which is the empty string whenever the
 * interpolation is last, and then bailed on the falsy suffix. That rejected the
 * correctly-labelled invite-link input in app/trips/groups/[slug]/page.tsx,
 * whose `<label htmlFor>` sits three lines above it. No `<select>` happened to
 * use that id shape, so the bug was invisible until the guard grew to cover
 * inputs. Comparing the whole template needs no suffix at all.
 */
function hasExplicitLabel(tag: string, source: string): boolean {
  const literal = tag.match(/\bid="([^"]+)"/);
  if (literal) return source.includes(`htmlFor="${literal[1]}"`);

  const templated = tag.match(/\bid=\{`([^`]+)`\}/);
  if (!templated) return false;
  return source.includes(`htmlFor={\`${templated[1]}\`}`);
}

/** True when this tag is one the guard does not require a name on. */
function isExempt(tagName: string, tag: string): boolean {
  if (/\baria-hidden="true"/.test(tag)) return true;
  if (tagName !== "input") return false;
  const type = tag.match(/\btype="([a-zA-Z]+)"/);
  return Boolean(type) && EXEMPT_INPUT_TYPES.has(type![1].toLowerCase());
}

function collectTsxFiles(dir: string, found: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectTsxFiles(full, found);
    } else if (entry.name.endsWith(".tsx")) {
      found.push(full);
    }
  }
  return found;
}

/**
 * Every guarded control in one file that no rule gives a name to, as
 * `<tag>:<line>` pairs.
 */
function unnamedControls(source: string): string[] {
  const clean = stripComments(source);
  const found: string[] = [];
  for (const match of clean.matchAll(/<(select|input|textarea)\b/g)) {
    const tagName = match[1];
    const tag = openingTag(clean, match.index);
    if (isExempt(tagName, tag)) continue;
    const named = /\baria-label[=\s]/.test(tag) || /\baria-labelledby[=\s]/.test(tag);
    if (named || insideLabel(clean, match.index) || hasExplicitLabel(tag, clean)) continue;
    found.push(`${tagName}:${clean.slice(0, match.index).split("\n").length}`);
  }
  return found;
}

/**
 * Throws if any `<select>`, `<input>` or `<textarea>` under `roots` ships
 * without an accessible name. Called from next.config.ts, which resolves the
 * roots from the build's cwd.
 */
export function assertFormControlsAreNamed(roots: string[]): void {
  const offenders: string[] = [];

  for (const root of roots) {
    if (!fs.existsSync(root)) {
      throw new Error(
        `form-control-name guard could not find ${root}. It resolves from the ` +
          "build's cwd, so run next build from apps/shell.",
      );
    }
    for (const file of collectTsxFiles(root)) {
      const source = fs.readFileSync(file, "utf8");
      if (!GUARDED_TAGS.some((tag) => source.includes(`<${tag}`))) continue;
      const relative = path.relative(root, file).split(path.sep).join("/");
      for (const hit of unnamedControls(source)) {
        const [tagName, line] = hit.split(":");
        offenders.push(`${relative}:${line} (<${tagName}>)`);
      }
    }
  }

  if (offenders.length > 0) {
    throw new Error(
      `These form controls have no accessible name: ${offenders.sort().join(", ")}. ` +
        "A screen reader announces them anonymously and an agent reading the " +
        "accessibility tree cannot tell them apart; it cost /vocabulary an " +
        "Accessibility 94 and an Agentic Browsing 67 (SHAN-532). A placeholder " +
        "does not count and never did: the browser erases it as soon as the " +
        "field has content, so the name is gone exactly when a user tabbing " +
        "back into a half-filled field needs it, and axe-core scores it green " +
        "anyway, which is how 23 of these survived an accessibility sweep " +
        "(SHAN-539). A first <option> that reads like a label is a value too, " +
        "and it is gone as soon as the filter is applied. Fix with aria-label, " +
        "or with id + <label htmlFor> when a visible label already exists, or " +
        "by wrapping the control in the <label> that describes it.",
    );
  }
}
