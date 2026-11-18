/**
 * Placing a popover against a run of text: the notes thread popover and the
 * knowledge term popover (SHAN-712) both open beside a word in the prose.
 * Boxes are in document coordinates so a popover positioned `absolute` on
 * <body> stays with its word while the page scrolls.
 */

export interface Box {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export function docBox(r: DOMRect): Box {
  return {
    top: r.top + window.scrollY,
    bottom: r.bottom + window.scrollY,
    left: r.left + window.scrollX,
    right: r.right + window.scrollX,
  };
}

/** The line of a (possibly wrapped) mark nearest the pointer, so the popover opens where you are looking. */
export function lineBoxOf(el: Element, clientY?: number): Box {
  const rects = [...el.getClientRects()];
  if (rects.length === 0) return docBox(el.getBoundingClientRect());
  if (clientY === undefined) return docBox(rects[0]);
  let best = rects[0];
  for (const r of rects) {
    if (Math.abs((r.top + r.bottom) / 2 - clientY) < Math.abs((best.top + best.bottom) / 2 - clientY)) best = r;
  }
  return docBox(best);
}

/** Places a panel of a known size against an anchor box: below if it fits, above if not. */
export function place(anchor: Box, width: number, height: number) {
  const vw = document.documentElement.clientWidth;
  const left = Math.min(Math.max(anchor.left - 14, window.scrollX + 16), window.scrollX + vw - width - 16);
  const roomBelow = window.scrollY + window.innerHeight - anchor.bottom;
  const above = roomBelow < height + 24 && anchor.top - window.scrollY > height + 24;
  return {
    left,
    top: above ? anchor.top - height - 10 : anchor.bottom + 10,
    above,
    originX: Math.min(Math.max(anchor.left - left + 12, 12), width - 12),
  };
}
