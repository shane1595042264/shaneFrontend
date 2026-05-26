import { getAuthHeaders } from "@/lib/auth-api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export interface UploadedImage {
  /** Absolute URL — safe to embed directly in markdown rendered from any host. */
  url: string;
  id: string;
}

/**
 * Upload a single image blob via multipart/form-data. Backend caps at 5MB and
 * image/* only; surfaces 401/403/413/415 with the server's error text.
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
    throw new Error(err.error || `Image upload failed (${res.status})`);
  }
  const data = (await res.json()) as { id: string; url: string };
  return { id: data.id, url: `${API_URL}${data.url}` };
}
