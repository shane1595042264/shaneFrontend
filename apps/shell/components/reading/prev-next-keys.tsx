"use client";

import { useEffect } from "react";
import { useTransitionRouter as useRouter } from "@/lib/view-transition";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.isContentEditable;
}

/**
 * ← or j goes to the older piece, → or k to the newer one: the journal's
 * entry keys (SHAN-597 era), shared with blog posts since SHAN-705. Ignored
 * while typing and with any modifier held, so it never fights the browser.
 */
export function PrevNextKeys({ prevHref, nextHref }: { prevHref: string | null; nextHref: string | null }) {
  const router = useRouter();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      if (isEditableTarget(e.target)) return;
      if ((e.key === "ArrowLeft" || e.key === "j") && prevHref) {
        e.preventDefault();
        router.push(prevHref);
      } else if ((e.key === "ArrowRight" || e.key === "k") && nextHref) {
        e.preventDefault();
        router.push(nextHref);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [prevHref, nextHref, router]);

  return null;
}
