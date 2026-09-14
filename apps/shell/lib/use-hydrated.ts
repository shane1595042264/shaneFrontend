"use client";

import { useEffect, useState } from "react";

/**
 * False on the server and during this component's own hydration render, true
 * from the first commit afterwards.
 *
 * Use it to gate any element whose presence depends on auth (or anything else
 * the server cannot know) on a prerendered page. Gating on `useAuth().loading`
 * is NOT enough. `loading` lives in a context above the page, and an ISR
 * document hydrates as several Suspense boundaries across separate tasks: if
 * /api/auth/me resolves after the provider has committed but before a lower
 * boundary hydrates, that boundary hydrates with `loading: false` and a real
 * user. It then renders a node the prerendered HTML never contained, so React
 * discards the server HTML for the subtree and client-renders it (Minified
 * React error #418 — SHAN-492). That is also why the bug was intermittent and
 * only visible signed in: signed out `setUser(null)` is a no-op bail-out.
 *
 * This flag is component-local state, so it is false during this component's
 * hydration render no matter what the auth context is doing. The first client
 * render always matches the server HTML and the gated element appears on the
 * next commit.
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);
  return hydrated;
}
