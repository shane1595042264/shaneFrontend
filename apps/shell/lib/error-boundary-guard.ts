// apps/shell/lib/error-boundary-guard.ts
//
// BUILD-TIME GUARD. Walks app/ and fails the build if a route error boundary
// (error.tsx or global-error.tsx) renders error.message or retries with a bare
// reset().
//
// Why both are bugs (SHAN-651). Every one of the 18 boundaries printed
// error.message. In a production build a Server Component error reaches the
// boundary with that message replaced by Next's redaction paragraph ("An error
// occurred in the Server Components render. The specific message is omitted in
// production builds..."), so a backend 500 on /blog/<slug> told a visitor "The
// blog failed to load: An error occurred in the Server Components render...".
// A client render crash printed "Cannot read properties of undefined". And the
// Retry buttons called reset() alone, which re-renders from the RSC payload the
// client already holds and so re-throws a server error without asking the
// server again: Retry did nothing until a full reload.
//
// The fix is two helpers, routeErrorMessage (lib/humanize-error.ts) and
// useRouteRetry (lib/use-route-retry.ts). Nothing about a new error.tsx would
// make its author reach for them, and the copy-paste source for the next one
// is whichever boundary sits nearest, so this turns the rule into an error the
// way lib/og-image-guard.ts did for share cards. A boundary that only ever
// catches client errors still uses both: the refresh is harmless there.
//
// This module uses node:fs and is imported only by next.config.ts, which the
// Node build/dev process evaluates and the serverless runtime never does. A
// violation fails `npm run build` and can never affect a production request.
import fs from "node:fs";
import path from "node:path";

const BOUNDARY_FILES = new Set(["error.tsx", "global-error.tsx"]);

/** Same two-step as lib/og-image-guard.ts, so prose about the rule cannot trip it. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => line.replace(/(^|[^:])\/\/.*$/, "$1"))
    .join("\n");
}

function collectBoundaries(dir: string, found: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectBoundaries(full, found);
    } else if (BOUNDARY_FILES.has(entry.name)) {
      found.push(full);
    }
  }
  return found;
}

function problemsIn(source: string): string[] {
  const clean = stripComments(source);
  const problems: string[] = [];
  if (/\berror\s*\.\s*message\b/.test(clean)) problems.push("renders error.message");
  if (!/\buseRouteRetry\s*\(/.test(clean)) problems.push("does not call useRouteRetry");
  return problems;
}

/**
 * Throws if any route error boundary shows the raw message or skips the
 * refreshing retry. Called from next.config.ts; `appDir` is resolved there
 * from the build's cwd.
 */
export function assertErrorBoundariesAreSafe(appDir: string): void {
  if (!fs.existsSync(appDir)) {
    throw new Error(
      `error-boundary guard could not find the app directory at ${appDir}. ` +
        "It resolves from the build's cwd, so run next build from apps/shell.",
    );
  }

  const offenders = collectBoundaries(appDir)
    .map((file) => ({
      file: path.relative(appDir, file).split(path.sep).join("/"),
      problems: problemsIn(fs.readFileSync(file, "utf8")),
    }))
    .filter((o) => o.problems.length > 0)
    .map((o) => `${o.file} (${o.problems.join(", ")})`)
    .sort();

  if (offenders.length > 0) {
    throw new Error(
      `These route error boundaries are unsafe: ${offenders.join("; ")}. ` +
        "In production a Server Component error's message is Next's redaction paragraph, " +
        "and a bare reset() re-throws it from the cached payload, so Retry does nothing " +
        "(SHAN-651). Render routeErrorMessage(error, \"<your fallback>\") from " +
        "@/lib/humanize-error and wire Retry to useRouteRetry(reset) from @/lib/use-route-retry.",
    );
  }
}
