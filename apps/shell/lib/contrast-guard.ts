// apps/shell/lib/contrast-guard.ts
//
// BUILD-TIME GUARD for the dark-theme text contrast floor. Walks the source
// tree and fails the build when a Tailwind gray text utility that cannot reach
// WCAG AA on this site's background is used.
//
// Why this exists: the site is permanently dark (#0a0a0a). Against that
// background the Tailwind gray scale gives exactly one muted tone that clears
// the 4.5:1 body-text threshold of WCAG 2.1 SC 1.4.3:
//
//   text-gray-400  #99a1af  7.61:1  passes
//   text-gray-500  #6a7282  4.10:1  fails
//   text-gray-600  #4a5565  2.61:1  fails badly
//
// SHAN-462 established that and replaced the gray-500 usages by hand. It never
// touched gray-600, so the identical defect simply persisted one shade down and
// went unnoticed for months, until a Lighthouse run on /knowledge scored 96 on
// two gray-600 nodes (SHAN-500). Hand-auditing a colour rule does not hold. This
// turns it into an error message that names the file, the line and the fix, the
// same way seo-routes-guard.ts did for crawler coverage (SHAN-497) and the docs
// registry did for the Elements Directory table (SHAN-494).
//
// Scope, deliberately narrow so the guard stays true rather than merely loud:
//   - Text utilities only. bg-gray-500/20 and border-gray-600 are backgrounds
//     and borders; SC 1.4.3 is about text, and the non-text 3:1 rule of SC 1.4.11
//     is a different audit with different maths.
//   - Any variant prefix counts (placeholder:, hover:, disabled:, dark:).
//     A placeholder is read as text, and a hover state darker than its resting
//     state is a bug in its own right.
//
// This module uses node:fs and is imported only by next.config.ts, which the
// Node build/dev process evaluates and the serverless runtime never does. A
// violation therefore fails `npm run build` loudly and can never affect a
// production request.
import fs from "node:fs";
import path from "node:path";

/** Gray shades that cannot reach 4.5:1 against the site background. */
const BANNED_SHADES = [500, 600, 700, 800, 900] as const;

/** The one muted tone that clears AA here. Named in every error message. */
const REPLACEMENT = `text-gray-400`;

/**
 * Built rather than written out so this file does not match its own rule and
 * need a self-exclusion. `text-gray-${shade}` is not a complete class name, so
 * Tailwind's source scanner has nothing to pick up from it either.
 */
const BANNED_CLASSES = BANNED_SHADES.map((shade) => `text-gray-${shade}`);

const BANNED_PATTERN = new RegExp(
  `(?:[a-z-]+:)*text-gray-(?:${BANNED_SHADES.join("|")})\\b`,
  "g",
);

/**
 * A line carrying this marker is skipped. Two shapes are legitimate today and
 * both are marked at the point of use rather than in a list here, so the reason
 * travels with the code:
 *
 *  - print-only styles, which land on white paper where the shade passes
 *    (components/journal/journal-entry-view.tsx);
 *  - disabled control states sitting on disabled:bg-gray-700 rather than on the
 *    page background, which SC 1.4.3 exempts as inactive components.
 */
const EXEMPT_MARKER = "contrast-exempt";

/**
 * How far above a violation the marker may sit. Both real exemptions need a
 * sentence or two of justification, and in JSX the offending className is its
 * own long line, so the comment has to go above it rather than beside it. Three
 * lines is enough room for that explanation without the marker drifting far
 * enough from the code to exempt something it was not written for.
 */
const EXEMPT_LOOKBACK_LINES = 3;

const SCANNED_EXTENSIONS = [".tsx", ".ts", ".css"];

/**
 * Blanks out block comments while preserving line count, then strips line
 * comments, so that merely *documenting* a banned class (this file's own header
 * does exactly that) is not a violation. The line-comment strip ignores a `//`
 * preceded by a colon so an `https://` inside a string literal does not
 * truncate its line. Mirrors stripComments in seo-routes-guard.ts.
 */
function stripCommentsPreservingLines(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (block) => "\n".repeat((block.match(/\n/g) || []).length))
    .split("\n")
    .map((line) => line.replace(/(^|[^:])\/\/.*$/, "$1"))
    .join("\n");
}

function collectSourceFiles(dir: string, found: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectSourceFiles(full, found);
    } else if (SCANNED_EXTENSIONS.some((ext) => entry.name.endsWith(ext))) {
      found.push(full);
    }
  }
  return found;
}

interface Violation {
  file: string;
  line: number;
  classNames: string[];
}

function scanFile(file: string): Violation[] {
  const raw = fs.readFileSync(file, "utf8").split("\n");
  const stripped = stripCommentsPreservingLines(raw.join("\n")).split("\n");

  const violations: Violation[] = [];
  for (let i = 0; i < stripped.length; i += 1) {
    // The marker is read from the raw lines, not the stripped ones, because it
    // lives in a comment.
    const exempted = raw
      .slice(Math.max(0, i - EXEMPT_LOOKBACK_LINES), i + 1)
      .some((line) => line.includes(EXEMPT_MARKER));
    if (exempted) continue;

    const matches = stripped[i].match(BANNED_PATTERN);
    if (matches) violations.push({ file, line: i + 1, classNames: matches });
  }
  return violations;
}

/**
 * Throws if any scanned file uses a banned gray text utility. Called from
 * next.config.ts; `roots` are resolved there from the build's cwd, which
 * `turbo build` sets to apps/shell.
 */
export function assertContrastFloor(roots: string[]): void {
  const violations: Violation[] = [];
  for (const root of roots) {
    if (!fs.existsSync(root)) {
      throw new Error(
        `contrast guard could not find the source directory at ${root}. ` +
          "Roots resolve from the build's cwd, so run next build from apps/shell.",
      );
    }
    for (const file of collectSourceFiles(root)) {
      violations.push(...scanFile(file));
    }
  }

  if (violations.length > 0) {
    const detail = violations
      .map((v) => `  ${path.relative(process.cwd(), v.file)}:${v.line}  ${v.classNames.join(" ")}`)
      .join("\n");
    throw new Error(
      `These gray text utilities cannot reach WCAG AA 4.5:1 on the site's #0a0a0a background ` +
        `(${BANNED_CLASSES.join(", ")} measure 4.1:1 and darker):\n${detail}\n` +
        `Use ${REPLACEMENT} (7.61:1), the muted tone SHAN-462 settled on. ` +
        `If the text genuinely renders somewhere else (a print:block block on white paper) or is a ` +
        `disabled control that SC 1.4.3 exempts, put a "${EXEMPT_MARKER}: <reason>" comment on that ` +
        `line or within the ${EXEMPT_LOOKBACK_LINES} lines above it.`,
    );
  }
}
