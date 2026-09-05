"use client";

import { useEffect } from "react";

/**
 * SHAN-453: re-applies the URL fragment once the doc page is hydrated.
 *
 * A cold load of /docs/auth#scopes left the viewport at scrollY 0 even though
 * the anchor existed. The article streams in a React Suspense chunk, so at the
 * moment the browser performs its one fragment scroll the only element with
 * that id is the copy still sitting in React's `<div hidden id="S:0">` staging
 * container -- display:none, so nothing to scroll to. Once the real content is
 * relocated the browser does not retry, and the deep link silently no-ops.
 *
 * Running after hydration lands on the visible copy (getElementById returns the
 * first match in document order, and the staging div is appended last).
 * In-page TOC clicks were always fine; this only covers arriving with a hash.
 */
export function DocHashScroll() {
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!id) return;
    // rAF so the scroll runs after the browser has laid the article out.
    const frame = requestAnimationFrame(() => {
      // "auto", not "smooth": smooth scrolls get dropped elsewhere in this app
      // and an instant jump is what a fragment load is supposed to look like.
      document.getElementById(id)?.scrollIntoView({ behavior: "auto" });
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  return null;
}
