"use client";

import NextLink from "next/link";
import { forwardRef, type ComponentProps } from "react";
import { useTransitionNav } from "@/lib/view-transition";

type LinkProps = ComponentProps<typeof NextLink>;

/**
 * SHAN-558: next/link with a view transition. A drop-in replacement, so every
 * file imports it as `Link` and nothing else changes at the call site.
 *
 * It only takes over a click that next/link would itself have routed
 * client-side: primary button, no modifier keys, same tab, same origin, a
 * string href, and a destination lib/view-transition.tsx wants to animate.
 * Anything else (cmd-click, target=_blank, a hash on the same page, an object
 * href, a browser without the API) is left to next/link exactly as before.
 * Prefetching is untouched, because the rendered element is still next/link.
 */
const TransitionLink = forwardRef<HTMLAnchorElement, LinkProps>(function TransitionLink(
  { onClick, ...props },
  ref,
) {
  const nav = useTransitionNav();

  return (
    <NextLink
      {...props}
      ref={ref}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || !nav) return;
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        if (props.target && props.target !== "_self") return;
        if (typeof props.href !== "string") return;
        const dest = new URL(props.href, window.location.href);
        if (!nav.wants(dest)) return;
        e.preventDefault();
        nav.navigate(dest.pathname + dest.search + dest.hash, {
          replace: props.replace,
          scroll: props.scroll ?? true,
          source: e.currentTarget,
        });
      }}
    />
  );
});

export default TransitionLink;
