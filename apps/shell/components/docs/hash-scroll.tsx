"use client";

import { useEffect } from "react";

/** Give up rather than yanking a reader who has started scrolling on their own. */
const DEADLINE_MS = 3000;

/**
 * SHAN-453: re-applies the URL fragment once the doc page is actually laid out.
 *
 * A cold load of /docs/auth#scopes or /docs/scoreboard-api#players left the
 * viewport at scrollY 0 even though the anchor existed. The article arrives in
 * a React Suspense chunk, so when the browser performs its one fragment scroll
 * the only element carrying that id is the copy inside React's hidden staging
 * container (`<div hidden id="S:0">`). scrollIntoView on a display:none node
 * silently no-ops, and once the real content is relocated the browser never
 * retries -- the deep link dies quietly.
 *
 * So we retry across frames until the id resolves to a node that is actually
 * rendered (offsetParent is null while it is still inside the hidden
 * container), then jump once. In-page TOC clicks were always fine; this only
 * covers arriving with a hash.
 */
export function DocHashScroll() {
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!id) return;

    const startedAt = Date.now();
    const initialScrollY = window.scrollY;
    let frame = 0;

    const attempt = () => {
      // The reader took over; leave them where they are.
      if (window.scrollY !== initialScrollY) return;

      const el = document.getElementById(id);
      if (el && el.offsetParent !== null) {
        // "auto", not "smooth": smooth scrolls get dropped elsewhere in this
        // app, and an instant jump is what a fragment load should look like.
        el.scrollIntoView({ behavior: "auto" });
        return;
      }
      if (Date.now() - startedAt < DEADLINE_MS) frame = requestAnimationFrame(attempt);
    };

    frame = requestAnimationFrame(attempt);
    return () => cancelAnimationFrame(frame);
  }, []);

  return null;
}
