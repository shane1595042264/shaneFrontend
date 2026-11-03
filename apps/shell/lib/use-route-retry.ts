"use client";

import { startTransition, useCallback } from "react";
import { useTransitionRouter } from "@/lib/view-transition";

/**
 * The Retry handler for an app/**\/error.tsx boundary (SHAN-651).
 *
 * reset() alone re-renders the segment from the RSC payload the client already
 * holds, so an error thrown by a Server Component (a backend 500 on
 * /blog/<slug>, /courses/<slug>, /trips/<slug>) is thrown again and Retry does
 * nothing until a full reload. Refreshing first makes the server render the
 * segment again; doing both inside one transition lets reset() land on the new
 * payload. For a client-side error the refresh is harmless and reset()
 * remounts the tree, which refires its fetch effects.
 */
export function useRouteRetry(reset: () => void): () => void {
  const router = useTransitionRouter();
  return useCallback(() => {
    startTransition(() => {
      router.refresh();
      reset();
    });
  }, [router, reset]);
}
