"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface EntryKeyboardNavProps {
  prevDate: string | null;
  nextDate: string | null;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.isContentEditable;
}

export function EntryKeyboardNav({ prevDate, nextDate }: EntryKeyboardNavProps) {
  const router = useRouter();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      if (isEditableTarget(e.target)) return;
      if (e.key === "ArrowLeft" && prevDate) {
        e.preventDefault();
        router.push(`/journal/${prevDate}`);
      } else if (e.key === "ArrowRight" && nextDate) {
        e.preventDefault();
        router.push(`/journal/${nextDate}`);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [prevDate, nextDate, router]);

  return null;
}
