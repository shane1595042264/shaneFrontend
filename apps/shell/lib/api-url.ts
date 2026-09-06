/**
 * Where API calls go (SHAN-458).
 *
 * - In the browser, API_URL is "" so every call is a same-origin request to
 *   /api/... and rides the rewrite in next.config.ts to the backend. No CORS
 *   preflight, and no third-party hostname for a corporate proxy to block
 *   (PMG's proxy intercepts *.railway.app and answered preflights with a
 *   redirect, which made every element show "Backend may be down").
 * - On the server (SSR, ISR, route handlers, sitemap, OG images) and at the
 *   edge (middleware), API_URL is the backend origin itself: there is no
 *   rewrite to ride and calling our own domain from inside a render would
 *   just add a hop.
 *
 * Never hard-code process.env.NEXT_PUBLIC_API_URL in client-reachable code;
 * import API_URL from here instead.
 */
export const BACKEND_ORIGIN = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export const API_URL: string = typeof window === "undefined" ? BACKEND_ORIGIN : "";
