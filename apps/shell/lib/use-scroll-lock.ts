import { useEffect } from "react";

/**
 * How many mounted dialogs currently want the page locked. Module-level so a
 * stacked pair (the knowledge comments delete-confirm at z-60 opening over the
 * entry detail at z-50) only unlocks once the *last* one closes.
 */
let lockCount = 0;
/** Undoes the styles captured by whichever dialog took the lock first. */
let release: (() => void) | null = null;

function lock() {
  const { body } = document;
  const previousOverflow = body.style.overflow;
  const previousPaddingRight = body.style.paddingRight;
  const previousScrollY = window.scrollY;

  // Width of the scrollbar we are about to hide. Adding it back as padding
  // keeps the page from jumping sideways as the dialog opens. The nav bar is
  // position:relative, so padding the body compensates for everything.
  const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
  if (scrollbarWidth > 0) {
    const current = parseFloat(getComputedStyle(body).paddingRight) || 0;
    body.style.paddingRight = `${current + scrollbarWidth}px`;
  }
  body.style.overflow = "hidden";

  release = () => {
    body.style.overflow = previousOverflow;
    body.style.paddingRight = previousPaddingRight;
    // overflow:hidden preserves the scroll offset in practice, so this is
    // insurance rather than the main mechanism — only correct a real drift.
    if (window.scrollY !== previousScrollY) window.scrollTo(0, previousScrollY);
  };
}

/**
 * Freezes the page behind a modal while it is open.
 *
 * Pass nothing from a component that only mounts while its dialog is open
 * (EntryDetail, MintTokenDialog, ...); pass the open flag from a component
 * that stays mounted and renders its overlay conditionally
 * (`useScrollLock(!!deleteConfirmId)`).
 *
 * Pair it with `overscroll-contain` on the dialog's own scrollable panel so a
 * flick past the end of that panel does not chain out to the document.
 */
export function useScrollLock(active: boolean = true) {
  useEffect(() => {
    if (!active) return;

    lockCount += 1;
    if (lockCount === 1) lock();

    return () => {
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount === 0) {
        release?.();
        release = null;
      }
    };
  }, [active]);
}
