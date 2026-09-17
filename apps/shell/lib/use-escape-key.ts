import { useEffect, useRef } from "react";

/**
 * Closes a dialog on Escape.
 *
 * The listener sits on `document`, not on the dialog's panel. A panel-level
 * `onKeyDown` only fires while focus is inside the panel, and a single click on
 * the backdrop parks focus on `<body>` — after that Escape silently stops
 * working. Listening on the document survives that.
 *
 * Pass `active: false` to refuse the dismissal while a write is in flight, the
 * way the hand-rolled handlers do (`e.key === "Escape" && !deleting`). Callers
 * that render their overlay conditionally while staying mounted should fold the
 * open flag in too: `useEscapeKey(close, open && !submitting)`.
 */
export function useEscapeKey(onEscape: () => void, active: boolean = true) {
  // Held in a ref so an inline arrow does not resubscribe on every render.
  const handler = useRef(onEscape);
  handler.current = onEscape;

  useEffect(() => {
    if (!active) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handler.current();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [active]);
}
