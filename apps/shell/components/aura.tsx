"use client";

import { useEffect } from "react";

/**
 * SHAN-558: the faint light that follows the pointer through the site's fog
 * (the rest of the aura is pure CSS in app/globals.css).
 *
 * It renders the same empty div on the server and the client, so it has
 * nothing for hydration to disagree about. The position is written straight
 * to two custom properties on <html> from a rAF-coalesced pointermove, never
 * through React state, so moving the mouse never re-renders anything.
 *
 * Touch input and prefers-reduced-motion leave it parked where the CSS puts
 * it, which reads as a fixed soft glow rather than a light that jumps to each
 * tap.
 */
export function Aura() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const root = document.documentElement;
    let frame = 0;
    let x = 0;
    let y = 0;
    let target: EventTarget | null = null;
    const apply = () => {
      frame = 0;
      root.style.setProperty("--aura-x", `${x}px`);
      root.style.setProperty("--aura-y", `${y}px`);
      // The .spot card under the pointer gets its own local coordinates
      // (app/globals.css draws the ring and the wash from them).
      const spot = target instanceof Element ? target.closest<HTMLElement>(".spot") : null;
      if (spot) {
        const r = spot.getBoundingClientRect();
        spot.style.setProperty("--sx", `${x - r.left}px`);
        spot.style.setProperty("--sy", `${y - r.top}px`);
      }
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      x = e.clientX;
      y = e.clientY;
      target = e.target;
      if (!frame) frame = requestAnimationFrame(apply);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return <div aria-hidden="true" className="site-light" />;
}
