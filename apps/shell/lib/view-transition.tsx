"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * SHAN-558: in-app navigation inside the View Transitions API.
 *
 * components/transition-link.tsx calls `navigate()` instead of letting
 * next/link route on its own. navigate() opens a view transition, starts the
 * App Router navigation inside its update callback, and holds the callback
 * open until the new pathname has committed, so the browser captures the
 * real next page as the "after" state. The animation itself lives in
 * app/globals.css.
 *
 * Three rules keep this from ever making the site worse than plain routing:
 *
 *  - It never runs where it cannot help: no View Transitions API, reduced
 *    motion, a hidden tab, or a same-page link (query or hash change only).
 *    Those fall through to next/link's ordinary behaviour.
 *  - It never holds the screen hostage. During a view transition the page
 *    shows a frozen snapshot, so a slow route would read as a hang; the
 *    callback resolves after MAX_HOLD_MS whether or not the route is ready.
 *  - It only ever puts each view-transition-name on one rendered element.
 *    A duplicate name makes the browser silently skip the whole transition,
 *    so the clicked label gives up "page-title" before the destination h1
 *    takes it.
 */

/** Longest the old page is held on screen while the next route commits. */
const MAX_HOLD_MS = 900;

/** Routes that are not App Router pages and must keep a plain navigation. */
const PASSTHROUGH = [/^\/learn(\/|$)/, /^\/api(\/|$)/, /^\/docs\/raw\//, /\.(txt|xml|json|png|ico)$/];

export interface NavigateOptions {
  replace?: boolean;
  scroll?: boolean;
  /** The element that was clicked; its label morphs into the next page's h1. */
  source?: Element | null;
}

interface TransitionNav {
  navigate: (href: string, opts?: NavigateOptions) => void;
  /** Whether navigate() would animate this destination. */
  wants: (dest: URL) => boolean;
}

const TransitionContext = createContext<TransitionNav | null>(null);

type ViewTransitionDoc = Document & {
  startViewTransition?: (cb: () => Promise<void> | void) => { finished: Promise<void> };
};

function canAnimate(): boolean {
  if (typeof document === "undefined") return false;
  if (typeof (document as ViewTransitionDoc).startViewTransition !== "function") return false;
  if (document.visibilityState !== "visible") return false;
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * The part of a clicked link that should travel to the next page's title:
 * an explicit [data-vt-title] inside it, or the link itself when it is a
 * short bare-text label (nav links, "Back to courses").
 */
function titleOf(source: Element | null | undefined): HTMLElement | null {
  if (!source) return null;
  const marked = source.matches("[data-vt-title]")
    ? source
    : source.querySelector("[data-vt-title]");
  if (marked instanceof HTMLElement) return marked;
  if (
    source instanceof HTMLElement &&
    source.children.length === 0 &&
    (source.textContent ?? "").trim().length > 0 &&
    (source.textContent ?? "").trim().length <= 40
  ) {
    return source;
  }
  return null;
}

/**
 * The first h1 that is actually on screen (the homepage keeps a hidden one),
 * narrowed to its [data-vt-title] part when it marks one, so a clicked label
 * lands on the matching words rather than on a heading that also holds an
 * icon or a symbol chip.
 */
function visibleTitle(): HTMLElement | null {
  const headings = Array.from(document.querySelectorAll<HTMLElement>("#main-content h1"));
  const h1 = headings.find(
    (h) => h.offsetParent !== null && h.getBoundingClientRect().top < window.innerHeight,
  );
  if (!h1) return null;
  return h1.querySelector<HTMLElement>("[data-vt-title]") ?? h1;
}

export function ViewTransitionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const settle = useRef<(() => void) | null>(null);

  // The new route has committed: let the transition capture it.
  useEffect(() => {
    const done = settle.current;
    if (!done) return;
    settle.current = null;
    done();
  }, [pathname]);

  const wants = useCallback((dest: URL) => {
    if (!canAnimate()) return false;
    if (dest.origin !== window.location.origin) return false;
    if (PASSTHROUGH.some((re) => re.test(dest.pathname))) return false;
    return dest.pathname !== window.location.pathname;
  }, []);

  const navigate = useCallback(
    (href: string, opts: NavigateOptions = {}) => {
      const go = () =>
        opts.replace
          ? router.replace(href, { scroll: opts.scroll })
          : router.push(href, { scroll: opts.scroll });

      const dest = new URL(href, window.location.href);
      if (!wants(dest)) {
        go();
        return;
      }

      const from = titleOf(opts.source);
      let to: HTMLElement | null = null;
      if (from) from.style.viewTransitionName = "page-title";

      const transition = (document as ViewTransitionDoc).startViewTransition!(
        () =>
          new Promise<void>((resolve) => {
            let finished = false;
            const finish = () => {
              if (finished) return;
              finished = true;
              settle.current = null;
              if (from) {
                from.style.viewTransitionName = "";
                to = visibleTitle();
                if (to) to.style.viewTransitionName = "page-title";
              }
              resolve();
            };
            settle.current = finish;
            window.setTimeout(finish, MAX_HOLD_MS);
            go();
          }),
      );

      transition.finished.finally(() => {
        if (from) from.style.viewTransitionName = "";
        if (to) to.style.viewTransitionName = "";
      });
    },
    [router, wants],
  );

  const value = useMemo(() => ({ navigate, wants }), [navigate, wants]);
  return <TransitionContext.Provider value={value}>{children}</TransitionContext.Provider>;
}

/** null outside the provider, so callers can fall back to plain routing. */
export function useTransitionNav(): TransitionNav | null {
  return useContext(TransitionContext);
}

/**
 * next/navigation's useRouter, with push and replace routed through the view
 * transition. Files import it as `useRouter`, so a programmatic navigation (a
 * redirect after a save, a "next" button) animates the same way a link does.
 * Everything else on the router (back, refresh, prefetch) is the original.
 */
export function useTransitionRouter(): ReturnType<typeof useRouter> {
  const router = useRouter();
  const nav = useContext(TransitionContext);
  return useMemo(() => {
    if (!nav) return router;
    return {
      ...router,
      push: (href: string, options?: { scroll?: boolean }) =>
        nav.navigate(href, { scroll: options?.scroll ?? true }),
      replace: (href: string, options?: { scroll?: boolean }) =>
        nav.navigate(href, { replace: true, scroll: options?.scroll ?? true }),
    };
  }, [router, nav]);
}

/**
 * Runs an in-page state change (a view switch, a tab) inside a view
 * transition when the browser can, and plainly when it cannot. `update` must
 * apply its DOM change synchronously; wrap React state in flushSync.
 */
export function withViewTransition(update: () => void): void {
  if (!canAnimate()) {
    update();
    return;
  }
  (document as ViewTransitionDoc).startViewTransition!(() => update());
}
