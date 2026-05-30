"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
        className={className ?? "inline-flex items-center gap-1 rounded border border-white/20 px-2.5 py-1 text-xs hover:bg-white/5 disabled:opacity-50"}
      >
        🎯 Practice
      </button>
      {showModal && (
        <PrescriptionModal itemId={itemId} itemName={itemName} onSaved={onConfigured} onCancel={() => setShowModal(false)} />
      )}
    </>
  );
}
