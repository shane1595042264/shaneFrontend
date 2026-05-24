// Per-viewer timezone helpers. Used by journal pages so the "today" pill,
// the "Write today's entry" CTA, and the [tz] tag on entries authored in a
// different zone all reflect the *viewer's* sense of today rather than UTC.

import type { AuthUser } from "./auth-api";

export const DEFAULT_TIMEZONE = "America/Chicago";

/**
 * Resolve the timezone the viewer wants to read the site in. Order of
 * preference: their saved profile TZ → the browser's detected TZ → Chicago.
 * Safe to call on the server (no `window`/`Intl.DateTimeFormat` access from
 * resolvedOptions in older Node may throw — caller can pass user only).
 */
export function resolveViewerTimezone(user?: AuthUser | null): string {
  if (user?.timezone) return user.timezone;
  if (typeof window !== "undefined") {
    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (detected) return detected;
    } catch {
      // ignore — fall through to default
    }
  }
  return DEFAULT_TIMEZONE;
}

/**
 * "Today" in YYYY-MM-DD for the given timezone. Uses en-CA locale because
 * it formats as ISO (YYYY-MM-DD) by default — no parsing required.
 */
export function getTodayInTimezone(timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    // Bad TZ — fall back to UTC slice
    return new Date().toISOString().slice(0, 10);
  }
}

/**
 * Decide whether to show the [tz] tag on a post. We only render the tag when
 * the author's TZ differs from the viewer's — same-TZ posts get no clutter.
 * Returns the short label to display (e.g. "America/Chicago") or null.
 */
export function timezoneTagFor(
  authorTimezone: string | null | undefined,
  viewerTimezone: string,
): string | null {
  if (!authorTimezone) return null;
  if (authorTimezone === viewerTimezone) return null;
  return authorTimezone;
}
