import { getAuthHeaders } from "@/lib/auth-api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export interface UploadedImage {
  /** Absolute URL — safe to embed directly in markdown rendered from any host. */
  url: string;
  id: string;
}

/** Error thrown when the daily upload quota (429) is hit; carries the honest wait time. */
export interface UploadQuotaError extends Error {
  status: 429;
  /** Seconds until the next upload will succeed, from the server's Retry-After header (0 if absent). */
  retryAfterSec: number;
}

/**
 * Format a Retry-After duration (seconds) as a compact human string:
 * "2h 35m", "3m", "45s". Rounds up so we never under-promise the wait.
 */
export function formatRetryAfter(seconds: number): string {
  const total = Math.max(1, Math.ceil(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  if (m > 0) return s > 0 ? `${m}m ${s}s` : `${m}m`;
  return `${s}s`;
}

/**
 * Upload a single image blob via multipart/form-data. Backend caps at 5MB and
 * image/* only; surfaces 401/403/413/415 with the server's error text.
 *
 * On 429 (daily quota) the backend sends an honest Retry-After header — the exact
 * seconds until the oldest upload leaves the trailing 24h window. We fold that into
 * the thrown error's message so the user sees a concrete wait time ("Try again in
 * 2h 35m.") instead of a dead-end "try again later", and expose retryAfterSec on the
 * error for any programmatic handling.
 */
export async function uploadImage(file: Blob, filename = "image"): Promise<UploadedImage> {
  const form = new FormData();
  // Preserve a filename — backend doesn't use it, but browsers reject FormData
  // entries that look like raw Blobs in some Content-Disposition paths.
  form.append("file", file, filename);
  const res = await fetch(`${API_URL}/api/journal/images`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (res.status === 429) {
      const raw = res.headers.get("Retry-After");
      const parsed = raw ? parseInt(raw, 10) : NaN;
      const retryAfterSec = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
      // Drop the server's vague trailing "Try again later." so we don't double up.
      const base = String(err.error || "Upload quota exceeded").replace(/\s*Try again later\.?\s*$/i, "");
      const message = retryAfterSec > 0
        ? `${base}. Try again in ${formatRetryAfter(retryAfterSec)}.`
        : `${base}. Try again later.`;
      const e = new Error(message) as UploadQuotaError;
      e.status = 429;
      e.retryAfterSec = retryAfterSec;
      throw e;
    }
    throw new Error(err.error || `Image upload failed (${res.status})`);
  }
  const data = (await res.json()) as { id: string; url: string };
  return { id: data.id, url: `${API_URL}${data.url}` };
}
