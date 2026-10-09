// apps/shell/lib/transition-link-guard.ts
//
// BUILD-TIME GUARD. Walks app/, components/ and lib/ and fails the build if a
// file imports `next/link`, or `useRouter` from `next/navigation`, anywhere
// except the two modules that wrap them.
//
// Why. SHAN-558 put every in-app navigation inside a view transition, and it
// did that by replacing the imports rather than by hooking the router:
// components/transition-link.tsx is next/link with an onClick that hands the
// click to lib/view-transition.tsx, and useTransitionRouter() is useRouter with
// push and replace routed the same way. All 80 Link files and 23 router files
// were switched by hand. A file that imports the originals still builds, still
// navigates and still prefetches; it just cuts instead of animating. Nothing
// else can catch that. There is no error, no console line, no Lighthouse audit
// for an animation that did not run, and the Claude-in-Chrome tab is hidden, so
// it always takes the no-animation path and an E2E there passes either way.
//
// The rule lived only in CLAUDE.md until SHAN-559. Every earlier house rule on
// this site that lived only in prose (the contrast floor, the one <main>, the
// OG image file convention, the cursor docs) drifted until a guard like this
// one enforced it, so this one starts enforced.
//
// What counts:
//  - any value import or re-export from "next/link", or a dynamic
//    import("next/link"). `import type` is allowed, because a type cannot
//    render a link.
//  - `useRouter` among the named imports from "next/navigation", aliased or
//    not (`useRouter as useNextRouter` is the same hook), or read off a
//    namespace import (`nav.useRouter`). Every other next/navigation export
//    (usePathname, useParams, notFound, redirect...) is fine: none of them
//    navigate on a click.
//
// packages/ui/src is deliberately out of scope. It cannot import from
// apps/shell, so a next/link there has no in-package fix; if it ever needs a
// link, the shell should pass its Link in as a prop.
//
// This module uses node:fs and is imported only by next.config.ts, which the
// Node build/dev process evaluates and the serverless runtime never does. A
// violation fails `npm run build` and can never affect a production request.
import fs from "node:fs";
import path from "node:path";

/**
 * Same two-step as lib/main-landmark-guard.ts: block comments first, then line
 * comments only where the `//` is not preceded by a colon, so an `https://`
 * inside a string literal does not truncate its line. Comments become an equal
 * run of newlines so reported line numbers stay right.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (block) => "\n".repeat((block.match(/\n/g) || []).length))
    .split("\n")
    .map((line) => line.replace(/(^|[^:])\/\/.*$/, "$1"))
    .join("\n");
}

function collectSourceFiles(dir: string, found: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectSourceFiles(full, found);
    } else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith(".d.ts")) {
      found.push(full);
    }
  }
  return found;
}

function lineAt(source: string, index: number): number {
  return source.slice(0, index).split("\n").length;
}

/** Lines that import a value from next/link (static, re-export or dynamic). */
function nextLinkLines(clean: string): number[] {
  const lines: number[] = [];
  for (const m of clean.matchAll(/\b(import|export)\s+(type\s+)?([^;]*?)\s*from\s*["']next\/link["']/g)) {
    if (m[2]) continue;
    lines.push(lineAt(clean, m.index!));
  }
  for (const m of clean.matchAll(/\bimport\s+["']next\/link["']/g)) {
    lines.push(lineAt(clean, m.index!));
  }
  for (const m of clean.matchAll(/\bimport\s*\(\s*["']next\/link["']\s*\)/g)) {
    lines.push(lineAt(clean, m.index!));
  }
  return lines;
}

/** Lines that pull useRouter out of next/navigation, however it is spelled. */
function nextRouterLines(clean: string): number[] {
  const lines: number[] = [];
  for (const m of clean.matchAll(
    /\b(import|export)\s+(type\s+)?\{([^}]*)\}\s*from\s*["']next\/navigation["']/g,
  )) {
    if (m[2]) continue;
    const specifiers = m[3]
      .split(",")
      .map((s) => s.trim().replace(/^type\s+/, ""))
      .filter((s) => !/^type\s/.test(s));
    if (specifiers.some((s) => s.split(/\s+as\s+/)[0] === "useRouter")) {
      lines.push(lineAt(clean, m.index!));
    }
  }
  for (const m of clean.matchAll(/\bimport\s+\*\s+as\s+(\w+)\s+from\s*["']next\/navigation["']/g)) {
    const reads = new RegExp(`\\b${m[1]}\\.useRouter\\b`, "g");
    for (const r of clean.matchAll(reads)) lines.push(lineAt(clean, r.index!));
  }
  return lines;
}

/**
 * Throws if any .ts/.tsx file under `roots` imports next/link outside
 * `linkWrapper`, or useRouter from next/navigation outside `routerWrapper`.
 *
 * Called from next.config.ts, which resolves every path from the build's cwd.
 */
export function assertTransitionNavigation(
  roots: string[],
  linkWrapper: string,
  routerWrapper: string,
): void {
  const linkHome = path.resolve(linkWrapper);
  const routerHome = path.resolve(routerWrapper);
  // The wrappers must still be the ones holding the originals. If either moved
  // and this guard kept pointing at the old path, the real wrapper would be
  // reported as the offender and someone would "fix" it by deleting the guard.
  for (const [file, find, what] of [
    [linkHome, nextLinkLines, "next/link"],
    [routerHome, nextRouterLines, "useRouter from next/navigation"],
  ] as const) {
    if (!fs.existsSync(file) || find(stripComments(fs.readFileSync(file, "utf8"))).length === 0) {
      throw new Error(
        `transition-link guard expected ${file} to be the one module importing ${what}, ` +
          "and it is missing or no longer does. If the wrapper moved, point this guard at " +
          "its new home in next.config.ts. It resolves from the build's cwd, so run next " +
          "build from apps/shell.",
      );
    }
  }

  const offenders: string[] = [];
  for (const root of roots) {
    if (!fs.existsSync(root)) {
      throw new Error(
        `transition-link guard could not find ${root}. It resolves from the ` +
          "build's cwd, so run next build from apps/shell.",
      );
    }
    for (const file of collectSourceFiles(root)) {
      const full = path.resolve(file);
      const source = fs.readFileSync(file, "utf8");
      if (!source.includes("next/link") && !source.includes("next/navigation")) continue;
      const clean = stripComments(source);
      const rel = path.relative(path.dirname(root), file).split(path.sep).join("/");
      if (full !== linkHome) {
        for (const line of nextLinkLines(clean)) offenders.push(`${rel}:${line} (next/link)`);
      }
      if (full !== routerHome) {
        for (const line of nextRouterLines(clean)) offenders.push(`${rel}:${line} (useRouter)`);
      }
    }
  }

  if (offenders.length > 0) {
    throw new Error(
      `These imports bypass the page transition: ${offenders.sort().join(", ")}. ` +
        "SHAN-558 runs every in-app navigation inside a view transition by swapping the " +
        "imports, so a file using the originals still builds and still navigates, it just " +
        "cuts instead of animating, and nothing else will ever report it. The fix is the " +
        'import line only: `import Link from "@/components/transition-link"` for next/link, ' +
        'and `import { useTransitionRouter as useRouter } from "@/lib/view-transition"` for ' +
        "useRouter (keep the other next/navigation hooks where they are). `import type` " +
        "from next/link is allowed.",
    );
  }
}
