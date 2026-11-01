"use client";

import { useState } from "react";
import { useTransitionRouter as useRouter } from "@/lib/view-transition";
import { useAuth } from "@/lib/auth-context";
import { getPrescription, createSessionFromItemIds } from "@/lib/api/practice";
import { PrescriptionModal } from "./prescription-modal";

interface Props {
  itemId: string;
  itemName: string;
  className?: string;
}

export function PracticeButton({ itemId, itemName, className }: Props) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [busy, setBusy] = useState(false);
  // SHAN-644: every failure here used to be a console.error, so the button
  // flipped back to "Practice" and the click read as ignored.
  const [error, setError] = useState<string | null>(null);

  const startSession = async (failure: string) => {
    setBusy(true);
    try {
      const { session } = await createSessionFromItemIds([itemId]);
      router.push(`/practice/sessions/${session.id}`);
    } catch {
      setError(failure);
      setBusy(false);
    }
  };

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setError(null);
    // Decided on click, not in render: the cards are server-rendered signed
    // out, so branching the tree on auth would break hydration (SHAN-492).
    if (!user && !loading) {
      setError("Sign in to practice.");
      return;
    }
    setBusy(true);
    let existing;
    try {
      existing = await getPrescription(itemId);
    } catch {
      setError("Couldn't start practice. Try again.");
      setBusy(false);
      return;
    }
    if (!existing) {
      setShowModal(true);
      setBusy(false);
      return;
    }
    await startSession("Couldn't start practice. Try again.");
  };

  const onConfigured = async () => {
    setShowModal(false);
    // The setup is saved by now, so a retry finds it and goes straight to the
    // session instead of reopening the modal.
    await startSession("Saved the setup, but couldn't start practice. Try again.");
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className={
          className ??
          "inline-flex h-7 items-center rounded-full px-3 text-xs text-gray-300 ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
        }
      >
        {busy ? "Opening..." : "Practice"}
      </button>
      {error && (
        <span role="alert" className="text-xs text-red-400">
          {error}
        </span>
      )}
      {showModal && (
        <PrescriptionModal itemId={itemId} itemName={itemName} onSaved={onConfigured} onCancel={() => setShowModal(false)} />
      )}
    </>
  );
}
