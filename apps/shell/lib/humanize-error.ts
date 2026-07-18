// apps/shell/lib/humanize-error.ts
//
// Turn a caught load error into something safe to show a user.
//
// The API layer (lib/api/*) throws Error("Failed to load X")-style messages for
// non-OK responses, and those are fine to surface. But when the network itself
// fails (offline, DNS, a CORS preflight that never lands), fetch() throws a
// browser-native TypeError whose message is implementation-specific and useless
// to a human: "Failed to fetch" (Chrome), "NetworkError when attempting to
// fetch resource." (Firefox), "Load failed" (Safari). Rendering that verbatim in
// an error banner reads as a broken app.
//
// humanizeError maps those network-type failures to one actionable message and
// falls back to a caller-supplied string for everything else — so a page's
// error state never shows a raw technical string.

const NETWORK_MESSAGE = "Network error — check your connection and try again.";

// Anchored to the browser-native network-failure strings so it never matches
// the API layer's intentional messages like "Failed to fetch inbox" (which has
// trailing text and would otherwise be misread as a connection problem):
//   Chrome/Edge: "Failed to fetch"      Safari: "Load failed"
//   Firefox: "NetworkError when attempting to fetch resource."
//   Node/undici (SSR wrappers): "fetch failed"
const NETWORK_PATTERN = /^failed to fetch$|^load failed$|^fetch failed$|networkerror/i;

function isNetworkError(e: unknown): boolean {
  // Every browser throws a TypeError for a failed fetch — that's the primary
  // signal. The anchored pattern is a fallback for re-wrapped errors.
  if (e instanceof TypeError) return true;
  const message = (e instanceof Error ? e.message : typeof e === "string" ? e : "").trim();
  return NETWORK_PATTERN.test(message);
}

/**
 * Return a user-facing message for a caught load error.
 * Network-type failures collapse to a single actionable message; everything
 * else returns `fallback` so raw technical strings are never rendered.
 */
export function humanizeError(e: unknown, fallback: string): string {
  return isNetworkError(e) ? NETWORK_MESSAGE : fallback;
}
