"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AuthGate } from "@/components/auth-gate";
import { useAuth } from "@/lib/auth-context";
import {
  fetchLoans,
  createLoan,
  updateLoan,
  deleteLoan,
  type LoanEntry,
  type UpdateLoanInput,
} from "@/lib/loans-api";

const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/;

export default function WhoOwesMePage() {
  return (
    <AuthGate>
      <WhoOwesMeContent />
    </AuthGate>
  );
}

function formatAmount(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function WhoOwesMeContent() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<LoanEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [borrowerName, setBorrowerName] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    fetchLoans()
      .then((rows) => {
        setEntries(rows);
        setError(null);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [user]);

  const outstanding = entries.filter((e) => e.status === "outstanding");
  const repaid = entries.filter((e) => e.status === "repaid");

  const totalsByCurrency = outstanding.reduce<Record<string, number>>((acc, e) => {
    acc[e.currency] = (acc[e.currency] ?? 0) + e.amount;
    return acc;
  }, {});

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (!borrowerName.trim() || !amount.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const entry = await createLoan({
        borrowerName: borrowerName.trim(),
        amount: amount.trim(),
        description: description.trim() || null,
      });
      setEntries((prev) => [entry, ...prev]);
      setBorrowerName("");
      setAmount("");
      setDescription("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleRepaid(entry: LoanEntry) {
    const nextStatus: LoanEntry["status"] = entry.status === "repaid" ? "outstanding" : "repaid";
    try {
      const updated = await updateLoan(entry.id, { status: nextStatus });
      setEntries((prev) => prev.map((e) => (e.id === entry.id ? updated : e)));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleDelete(entry: LoanEntry) {
    if (!confirm(`Delete loan to ${entry.borrowerName}?`)) return;
    try {
      await deleteLoan(entry.id);
      setEntries((prev) => prev.filter((e) => e.id !== entry.id));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function handleSave(entry: LoanEntry, patch: UpdateLoanInput) {
    const updated = await updateLoan(entry.id, patch);
    setEntries((prev) => prev.map((e) => (e.id === entry.id ? updated : e)));
    setEditingId(null);
  }

  return (
    <div className="space-y-8">
      <section className="rounded-lg border border-orange-500/30 bg-orange-950/20 px-5 py-4">
        <div className="text-xs uppercase tracking-wider text-orange-300/70">
          Outstanding
        </div>
        {Object.keys(totalsByCurrency).length === 0 ? (
          <div className="text-2xl font-semibold text-white mt-1">$0.00</div>
        ) : (
          <div className="flex flex-wrap items-baseline gap-4 mt-1">
            {Object.entries(totalsByCurrency).map(([cur, total]) => (
              <div key={cur} className="text-2xl font-semibold text-white">
                {formatAmount(total, cur)}
              </div>
            ))}
          </div>
        )}
        <div className="text-xs text-gray-400 mt-1">
          {outstanding.length} {outstanding.length === 1 ? "loan" : "loans"} unpaid
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-300 mb-3">Add a loan</h2>
        <form onSubmit={handleSubmit} className="grid gap-3 md:grid-cols-[1fr_140px_auto]">
          <input
            value={borrowerName}
            onChange={(e) => setBorrowerName(e.target.value)}
            placeholder="Who borrowed?"
            maxLength={255}
            required
            className="px-3 py-2 rounded bg-white/5 border border-white/10 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/50"
          />
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount"
            inputMode="decimal"
            required
            className="px-3 py-2 rounded bg-white/5 border border-white/10 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/50"
          />
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 rounded bg-orange-500/90 hover:bg-orange-500 text-sm font-medium text-white disabled:opacity-50"
          >
            {submitting ? "Adding…" : "Add"}
          </button>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Note (optional)"
            rows={2}
            maxLength={2000}
            className="md:col-span-3 px-3 py-2 rounded bg-white/5 border border-white/10 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/50 resize-y"
          />
        </form>
        {error && <p className="mt-2 text-red-400 text-sm">{error}</p>}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-300 mb-3">
          Outstanding loans
        </h2>
        {loading ? (
          <p className="text-gray-500 text-sm">Loading…</p>
        ) : outstanding.length === 0 ? (
          <p className="text-gray-500 text-sm">No one owes you anything. Yet.</p>
        ) : (
          <ul className="divide-y divide-white/5 border border-white/10 rounded-lg overflow-hidden">
            {outstanding.map((entry) => (
              <LoanRow
                key={entry.id}
                entry={entry}
                isEditing={editingId === entry.id}
                onStartEdit={() => setEditingId(entry.id)}
                onCancelEdit={() => setEditingId(null)}
                onSave={(patch) => handleSave(entry, patch)}
                onToggle={() => handleToggleRepaid(entry)}
                onDelete={() => handleDelete(entry)}
              />
            ))}
          </ul>
        )}
      </section>

      {repaid.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-300 mb-3">Repaid</h2>
          <ul className="divide-y divide-white/5 border border-white/10 rounded-lg overflow-hidden">
            {repaid.map((entry) => (
              <LoanRow
                key={entry.id}
                entry={entry}
                isEditing={editingId === entry.id}
                onStartEdit={() => setEditingId(entry.id)}
                onCancelEdit={() => setEditingId(null)}
                onSave={(patch) => handleSave(entry, patch)}
                onToggle={() => handleToggleRepaid(entry)}
                onDelete={() => handleDelete(entry)}
                muted
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function LoanRow({
  entry,
  isEditing,
  onStartEdit,
  onCancelEdit,
  onSave,
  onToggle,
  onDelete,
  muted = false,
}: {
  entry: LoanEntry;
  isEditing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: (patch: UpdateLoanInput) => Promise<void>;
  onToggle: () => void;
  onDelete: () => void;
  muted?: boolean;
}) {
  const created = new Date(entry.createdAt).toLocaleDateString();
  const repaidAt = entry.repaidAt ? new Date(entry.repaidAt).toLocaleDateString() : null;

  if (isEditing) {
    return (
      <LoanRowEdit
        entry={entry}
        onSave={onSave}
        onCancel={onCancelEdit}
        muted={muted}
      />
    );
  }

  return (
    <li
      className={`flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 bg-white/5 ${
        muted ? "opacity-60" : ""
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-3">
          <span className="font-medium text-white truncate">{entry.borrowerName}</span>
          <span className="text-sm text-gray-400">
            {formatAmount(entry.amount, entry.currency)}
          </span>
        </div>
        {entry.description && (
          <div className="text-xs text-gray-400 mt-1 whitespace-pre-wrap">
            {entry.description}
          </div>
        )}
        <div className="text-xs text-gray-500 mt-1">
          lent {created}
          {repaidAt && ` · repaid ${repaidAt}`}
        </div>
      </div>
      <div className="flex gap-2 shrink-0">
        <button
          onClick={onStartEdit}
          className="px-3 py-1.5 rounded text-xs border border-white/10 hover:bg-white/10 text-gray-200"
        >
          Edit
        </button>
        <button
          onClick={onToggle}
          className="px-3 py-1.5 rounded text-xs border border-white/10 hover:bg-white/10 text-gray-200"
        >
          {entry.status === "repaid" ? "Mark unpaid" : "Mark repaid"}
        </button>
        <button
          onClick={onDelete}
          className="px-3 py-1.5 rounded text-xs border border-red-500/20 hover:bg-red-500/10 text-red-300"
        >
          Delete
        </button>
      </div>
    </li>
  );
}

function LoanRowEdit({
  entry,
  onSave,
  onCancel,
  muted,
}: {
  entry: LoanEntry;
  onSave: (patch: UpdateLoanInput) => Promise<void>;
  onCancel: () => void;
  muted: boolean;
}) {
  const [borrowerName, setBorrowerName] = useState(entry.borrowerName);
  const [amount, setAmount] = useState(entry.amount.toString());
  const [description, setDescription] = useState(entry.description ?? "");
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault();
    const trimmedName = borrowerName.trim();
    const trimmedAmount = amount.trim();
    if (!trimmedName) {
      setLocalError("Borrower name is required.");
      return;
    }
    if (!AMOUNT_PATTERN.test(trimmedAmount)) {
      setLocalError("Amount must be a non-negative number with up to 2 decimals.");
      return;
    }
    const trimmedDesc = description.trim();
    const currentDesc = entry.description ?? "";

    const patch: UpdateLoanInput = {};
    if (trimmedName !== entry.borrowerName) patch.borrowerName = trimmedName;
    if (Number(trimmedAmount) !== entry.amount) patch.amount = trimmedAmount;
    if (trimmedDesc !== currentDesc) patch.description = trimmedDesc.length > 0 ? trimmedDesc : null;

    if (Object.keys(patch).length === 0) {
      onCancel();
      return;
    }

    setSaving(true);
    setLocalError(null);
    try {
      await onSave(patch);
    } catch (e) {
      setLocalError((e as Error).message);
      setSaving(false);
    }
  }

  return (
    <li className={`px-4 py-3 bg-white/5 ${muted ? "opacity-60" : ""}`}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-[1fr_140px]">
          <input
            value={borrowerName}
            onChange={(e) => setBorrowerName(e.target.value)}
            placeholder="Who borrowed?"
            maxLength={255}
            aria-label="Borrower name"
            className="px-3 py-2 rounded bg-white/5 border border-white/10 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/50"
          />
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount"
            inputMode="decimal"
            aria-label="Amount"
            className="px-3 py-2 rounded bg-white/5 border border-white/10 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/50"
          />
        </div>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Note (optional)"
          rows={2}
          maxLength={2000}
          aria-label="Note"
          className="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/50 resize-y"
        />
        {localError && <p className="text-red-400 text-xs">{localError}</p>}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="px-3 py-1.5 rounded text-xs bg-orange-500/90 hover:bg-orange-500 text-white disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="px-3 py-1.5 rounded text-xs border border-white/10 hover:bg-white/10 text-gray-200 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </li>
  );
}
