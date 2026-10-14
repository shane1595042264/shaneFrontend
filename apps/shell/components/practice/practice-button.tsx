"use client";

import { useState } from "react";
import { useTransitionRouter as useRouter } from "@/lib/view-transition";
import { getPrescription, createSessionFromItemIds } from "@/lib/api/practice";
import { PrescriptionModal } from "./prescription-modal";

interface Props {
  itemId: string;
  itemName: string;
  className?: string;
}

export function PracticeButton({ itemId, itemName, className }: Props) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setBusy(true);
    try {
      const existing = await getPrescription(itemId);
      if (!existing) {
        setShowModal(true);
        setBusy(false);
        return;
      }
      const { session } = await createSessionFromItemIds([itemId]);
      router.push(`/practice/sessions/${session.id}`);
    } catch (err) {
      console.error(err);
      setBusy(false);
    }
  };

  const onConfigured = async () => {
    setShowModal(false);
    try {
      const { session } = await createSessionFromItemIds([itemId]);
      router.push(`/practice/sessions/${session.id}`);
    } catch (err) {
      console.error(err);
    }
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
      {showModal && (
        <PrescriptionModal itemId={itemId} itemName={itemName} onSaved={onConfigured} onCancel={() => setShowModal(false)} />
      )}
    </>
  );
}
