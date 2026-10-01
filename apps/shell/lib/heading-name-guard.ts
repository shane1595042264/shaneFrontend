// apps/shell/lib/heading-name-guard.ts
//
// BUILD-TIME GUARD. Walks app/, components/ and packages/ui/src and fails the
// build if a heading self-link that carries its own accessible name sits inside
// an element that does not override the name it would otherwise compute.
//
// The bug this exists to prevent (SHAN-550). SHAN-542 and SHAN-543 put a
// hover-revealed `#` self-link inside every h2/h3 on /blog and /docs so a
// section can be cited, and gave each link a descriptive
// `aria-label={`Link to section: ${text}`}` rather than a shared "Link to this
// section", because 25 links reading identically while pointing somewhere
// different is the identical-links-same-purpose smell. That part was right. What
// nobody checked is what it did to the heading wrapped around it.
//
// Accessible name computation (accname step 2F, name from content) walks a
// node's descendants and, for each one, computes *that node's* accessible name
// rather than its text -- and `aria-label` wins over content. So the label that
// fixed the link list was concatenated onto the end of the heading's own name.
// Measured on prod with Chrome's accessibility tree:
//
//   heading "Endpoints Link to section: Endpoints" level="2"
//   heading "How to use this Link to section: How to use this" level="2"
//
// 27 of the 29 headings on /blog/all-behavioral-questions-dinp and 7 of the 8 on
// /docs/journal-api; only the page h1, which has no anchor, was clean. That is
// every one of the 13 sitemap-listed /docs pages and every blog post. Heading
// navigation is the primary way a screen reader user moves through a long
// document, and the behavioral-questions post is 29 sections of exactly that
// shape, so every row of that list repeated itself.
//
// Why a guard rather than an audit. Lighthouse cannot see this: that same post
// scores accessibility 100, best-practices 100, SEO 100 and agentic-browsing 100
// on mobile, 55 audits passed and 0 failed, both before and after the fix. There
// is no axe rule for a redundant accessible name -- a doubled name is a correct
// name, just a useless one -- so the only way to observe it is to read the
// accessibility tree, and the only way to keep it fixed is to check the markup.
// The same two tickets left two near-identical copies of this heading component
// (components/blog/post-body.tsx and app/docs/[slug]/page.tsx), which is exactly
// how one oversight became two, so a third copy is the thing to stop.
//
// This module uses node:fs and is imported only by next.config.ts, which the
// Node build/dev process evaluates and the serverless runtime never does. A
// violation fails `npm run build` and can never affect a production request.
import fs from "node:fs";
import path from "node:path";

/**
 * Same two-step as lib/main-landmark-guard.ts and lib/form-control-name-guard.ts:
 * block comments first, then line comments only where the `//` is not preceded
 * by a colon, so an `https://` inside a string literal does not truncate its
 * line.
 *
 * JSX comments come out for free, since `{/* ... *\/}` is a block comment in
 * braces and the inner block carries the prose. That matters more here than
 * usual: both heading components explain this very rule in a `{/* ... *\/}`
 * directly above the anchor the guard is looking for, and the fix itself adds a
 * `//` comment naming `aria-labelledby` just above the heading tag -- so an
 * unstripped file would both match on its own documentation and pass on it.
 *
 * Replacing comments with an equal run of newlines rather than "" keeps every
 * subsequent line number intact, which matters because the error message reports
 * `file:line` for a human to open.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (block) => "\n".repeat((block.match(/\n/g) || []).length))
    .split("\n")
    .map((line) => line.replace(/(^|[^:])\/\/.*$/, "$1"))
    .join("\n");
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
 * The attribute text of the JSX opening tag starting at `open`, plus the tag
 * name.
 *
 * Scans to the `>` that closes the tag while skipping anything inside a brace
 * expression, so `aria-label={cond ? ">" : "<"}` cannot end the tag early.
 * Quotes are not tracked separately because every `>` in a JSX string attribute
 * value would have to be inside one of those braces or inside quotes that the
 * brace depth already covers for our purposes -- and a stray unbalanced brace
 * yields a too-long attribute string, which can only produce a false pass on the
 * enclosing-element check, never a false failure.
 */
function openingTag(clean: string, open: number): { name: string; attrs: string } | null {
  const nameMatch = /^<([A-Za-z][A-Za-z0-9.]*)/.exec(clean.slice(open));
  if (!nameMatch) return null;
  let depth = 0;
  for (let i = open + nameMatch[0].length; i < clean.length; i += 1) {
    const ch = clean[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") depth -= 1;
    else if (ch === ">" && depth === 0) {
      return { name: nameMatch[1], attrs: clean.slice(open + nameMatch[0].length, i) };
    }
  }
  return null;
}

/**
 * Every `<a>` in one file that is a heading self-link carrying its own
 * accessible name: an anchor whose `href` is a bare `#` fragment and which also
 * sets `aria-label` or `aria-labelledby`.
 *
 * Both halves are required, and that is the whole point of the rule. A fragment
 * link with no name of its own contributes its text to the heading, which is the
 * `#` glyph and harmless. A named link anywhere other than inside a heading is
 * just a named link. It is only a named link nested in a heading that silently
 * extends the heading's name.
 */
function namedFragmentAnchors(clean: string): number[] {
  const found: number[] = [];
  for (const match of clean.matchAll(/<a\b/g)) {
    const tag = openingTag(clean, match.index);
    if (!tag) continue;
    if (!/href=\{?[`"']#/.test(tag.attrs)) continue;
    if (!/\baria-label(?:ledby)?=/.test(tag.attrs)) continue;
    found.push(match.index);
  }
  return found;
}

/**
 * Whether a JSX tag name renders an HTML heading.
 *
 * `h1`-`h6` are the easy half. The other half is that neither heading component
 * in this repo writes one: both build `h2` and `h3` from a single factory and
 * render `<Tag ...>`, where the name is a parameter. So a tag whose name is an
 * identifier counts as a heading when the same file declares that identifier as
 * a union of heading literals -- `function anchored(Tag: "h2" | "h3")` is the
 * shape in both files. That keys the decision on a real declaration a few lines
 * up rather than on a guess about what a capitalised tag might render.
 *
 * A component that renders a heading without saying so in its own parameter list
 * is therefore invisible to this guard. That is the deliberate trade: the
 * alternative is flagging every named fragment link under any wrapper, which
 * over-fires immediately -- components/journal/entry-appends.tsx has a correct
 * "Permalink to this sub-entry" link inside a plain <div>, and a <div> is
 * `generic`, names nothing from its contents, and pollutes nothing.
 */
function isHeadingTag(name: string, clean: string): boolean {
  if (/^h[1-6]$/.test(name)) return true;
  const declared = new RegExp(
    `\\b${name.replace(/\./g, "\\.")}\\s*:\\s*(?:"h[1-6]"\\s*\\|\\s*)*"h[1-6]"`,
  );
  return declared.test(clean);
}

/**
 * Every JSX opening tag still open at `anchor`, nearest ancestor first.
 *
 * Walks backwards over opening tags, skipping any that self-closed (`/>`) or
 * whose close tag appears before the anchor, which in practice is every sibling
 * rendered above it.
 *
 * The close-tag test is textual, so two nested elements of the same name can
 * make the outer one look closed by the inner one's `</div>`. That is acceptable
 * precisely because of the direction it errs: a missed ancestor means a heading
 * this guard does not notice (a false pass), never a false failure in someone's
 * build. Headings do not nest, so the ancestor that matters here is never the
 * one being dropped.
 */
function ancestors(clean: string, anchor: number): { name: string; attrs: string }[] {
  const chain: { name: string; attrs: string }[] = [];
  for (const match of [...clean.slice(0, anchor).matchAll(/<([A-Za-z][A-Za-z0-9.]*)/g)].reverse()) {
    const tag = openingTag(clean, match.index);
    if (!tag) continue;
    if (tag.attrs.trimEnd().endsWith("/")) continue;
    const close = new RegExp(`</${tag.name.replace(/\./g, "\\.")}>`);
    if (close.test(clean.slice(match.index, anchor))) continue;
    chain.push(tag);
  }
  return chain;
}

/**
 * Throws if any `.tsx` file under `roots` nests a named heading self-link inside
 * an element that does not name itself.
 *
 * The required fix is `aria-labelledby` on the enclosing heading, pointing at a
 * span around the heading's own text (see headingLabelId() in
 * lib/markdown-headings.ts). `aria-label` on the heading is accepted too -- it
 * overrides the computation just as completely -- but it is the weaker of the
 * two, because a browser's translate feature rewrites content and not
 * attributes, so a translated page would announce the untranslated original.
 *
 * Called from next.config.ts, which resolves `roots` from the build's cwd.
 */
export function assertHeadingsNameThemselves(roots: string[]): void {
  const offenders: string[] = [];
  for (const root of roots) {
    if (!fs.existsSync(root)) {
      throw new Error(
        `heading-name guard could not find ${root}. It resolves from the ` +
          "build's cwd, so run next build from apps/shell.",
      );
    }
    for (const file of collectTsxFiles(root)) {
      const source = fs.readFileSync(file, "utf8");
      if (!source.includes("aria-label")) continue;
      const clean = stripComments(source);
      for (const anchor of namedFragmentAnchors(clean)) {
        const chain = ancestors(clean, anchor);
        // An aria-hidden wrapper takes the link out of the tree entirely, so it
        // reaches no name computation and there is nothing to report.
        const hiddenAt = chain.findIndex((t) => /\baria-hidden\b/.test(t.attrs));
        const headingAt = chain.findIndex((t) => isHeadingTag(t.name, clean));
        if (headingAt === -1) continue;
        if (hiddenAt !== -1 && hiddenAt <= headingAt) continue;
        const heading = chain[headingAt];
        if (/\baria-label(?:ledby)?=/.test(heading.attrs)) continue;
        const line = clean.slice(0, anchor).split("\n").length;
        offenders.push(
          `${path.relative(root, file).split(path.sep).join("/")}:${line} (inside <${heading.name}>)`,
        );
      }
    }
  }

  if (offenders.length > 0) {
    throw new Error(
      `These heading self-links leak their aria-label into the accessible name of the ` +
        `element wrapping them: ${offenders.sort().join(", ")}. Accessible name computation ` +
        "walks a heading's descendants and takes each one's own accessible name, and " +
        "aria-label beats content, so a `#` link labelled \"Link to section: Endpoints\" " +
        "inside <h2>Endpoints</h2> makes the heading itself announce as \"Endpoints Link to " +
        "section: Endpoints\". SHAN-550 measured that on 27 of 29 headings on the first real " +
        "blog post and 7 of 8 on /docs/journal-api -- every /docs page and every post -- and " +
        "heading navigation is how a screen reader reads a long document, so every row of " +
        "that list repeated itself. Lighthouse scores all of it 100 either way: a doubled " +
        "name is a correct name, so no audit fires and only the accessibility tree shows it. " +
        "Fix: point the heading's aria-labelledby at a span wrapping its own text, the way " +
        "components/blog/post-body.tsx and app/docs/[slug]/page.tsx do with headingLabelId(). " +
        "Do not instead drop the link's label -- 25 links reading \"Link to this section\" " +
        "while pointing somewhere different is the smell SHAN-542 removed. Do not aria-hidden " +
        "the link either: it is focusable on purpose (focus:opacity-100), so hiding it would " +
        "need tabindex=-1 and would take the affordance away from keyboard users.",
    );
  }
}
