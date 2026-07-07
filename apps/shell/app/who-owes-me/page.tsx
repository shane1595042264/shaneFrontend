"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AuthGate } from "@/components/auth-gate";
import { FocusTrappedDiv } from "@/components/focus-trapped-div";
import { useAuth } from "@/lib/auth-context";
import { RelativeTime } from "@/lib/format-time";
import {
  fetchLoans,
  createLoan,
  updateLoan,
  deleteLoan,
  type LoanEntry,
  type LoanDirection,
  type UpdateLoanInput,
} from "@/lib/loans-api";

const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/;

// Curated ISO 4217 codes for the currency selector. All are valid 3-letter
// codes, so the picker can never send something the backend rejects. The
// backend accepts any ISO 4217 code (SHAN-358); this list just covers the
// common ones without turning the field into free text.
const CURRENCIES = [
  "USD",
  "EUR",
  "GBP",
  "JPY",
  "CNY",
  "CAD",
  "AUD",
  "CHF",
  "HKD",
  "SGD",
  "INR",
] as const;

// Copy that flips with the direction of the debt. "owed_to_me" is the legacy
// default (someone borrowed from you); "i_owe" is money you owe someone else.
const DIRECTION_COPY: Record<
  LoanDirection,
  { namePlaceholder: string; verb: string; badge: string }
> = {
  owed_to_me: { namePlaceholder: "Who borrowed?", verb: "lent", badge: "Owes you" },
  i_owe: { namePlaceholder: "Who do you owe?", verb: "borrowed", badge: "You owe" },
};

function sumByCurrency(entries: LoanEntry[]): Record<string, number> {
  return entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.currency] = (acc[e.currency] ?? 0) + e.amount;
    return acc;
  }, {});
}

function formatTotals(totals: Record<string, number>): string {
  const keys = Object.keys(totals);
  if (keys.length === 0) return "$0.00";
  return keys.map((cur) => formatAmount(totals[cur], cur)).join(" · ");
}

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
  const [currency, setCurrency] = useState("USD");
  const [description, setDescription] = useState("");
  const [direction, setDirection] = useState<LoanDirection>("owed_to_me");
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<LoanEntry | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  useEffect(() => {
    if (!deleteTarget) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !deleting) {
        setDeleteTarget(null);
        setDeleteError(null);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [deleteTarget, deleting]);

  // Outstanding sorted oldest-first so stale debts surface at the top —
  // the API returns newest-first, which buries old loans that need chasing.
  const outstanding = entries
    .filter((e) => e.status === "outstanding")
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const repaid = entries.filter((e) => e.status === "repaid");

  const owedToMe = outstanding.filter((e) => e.direction === "owed_to_me");
  const iOwe = outstanding.filter((e) => e.direction === "i_owe");
  const owedToMeTotals = sumByCurrency(owedToMe);
  const iOweTotals = sumByCurrency(iOwe);

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault();
    const trimmedName = borrowerName.trim();
    const trimmedAmount = amount.trim();
    if (!trimmedName || !trimmedAmount) return;
    // Catch bad amounts (negatives, extra decimals) before the round-trip so the
    // user gets a clear message instead of a raw validation error.
    if (!AMOUNT_PATTERN.test(trimmedAmount)) {
      setError("Amount must be a non-negative number with up to 2 decimals.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const entry = await createLoan({
        borrowerName: trimmedName,
        amount: trimmedAmount,
        currency,
        description: description.trim() || null,
        direction,
      });
      setEntries((prev) => [entry, ...prev]);
      setBorrowerName("");
      setAmount("");
      setCurrency("USD");
      setDescription("");
      setDirection("owed_to_me");
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

  function requestDelete(entry: LoanEntry) {
    setDeleteError(null);
    setDeleteTarget(entry);
  }

  function dismissDelete() {
    if (deleting) return;
    setDeleteTarget(null);
    setDeleteError(null);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteLoan(deleteTarget.id);
      setEntries((prev) => prev.filter((e) => e.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (e) {
      setDeleteError((e as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  async function handleSave(entry: LoanEntry, patch: UpdateLoanInput) {
    const updated = await updateLoan(entry.id, patch);
    setEntries((prev) => prev.map((e) => (e.id === entry.id ? updated : e)));
    setEditingId(null);
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-orange-500/30 bg-orange-950/20 px-5 py-4">
          <div className="text-xs uppercase tracking-wider text-orange-300/70">
            They owe you
          </div>
          <div className="text-2xl font-semibold text-white mt-1">
            {formatTotals(owedToMeTotals)}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {owedToMe.length} {owedToMe.length === 1 ? "loan" : "loans"} unpaid
          </div>
        </div>
        <div className="rounded-lg border border-sky-500/30 bg-sky-950/20 px-5 py-4">
          <div className="text-xs uppercase tracking-wider text-sky-300/70">
            You owe
          </div>
          <div className="text-2xl font-semibold text-white mt-1">
            {formatTotals(iOweTotals)}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {iOwe.length} {iOwe.length === 1 ? "debt" : "debts"} unpaid
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-300 mb-3">Add a loan</h2>
        <div
          role="group"
          aria-label="Loan direction"
          className="inline-flex mb-3 rounded-lg border border-white/10 p-0.5 bg-white/5"
        >
          {(["owed_to_me", "i_owe"] as LoanDirection[]).map((dir) => (
            <button
              key={dir}
              type="button"
              onClick={() => setDirection(dir)}
              aria-pressed={direction === dir}
              className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${
                direction === dir
                  ? "bg-orange-500/90 text-white"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {dir === "owed_to_me" ? "They owe me" : "I owe them"}
            </button>
          ))}
        </div>
        <form onSubmit={handleSubmit} className="grid gap-3 md:grid-cols-[1fr_140px_100px_auto]">
          <input
            value={borrowerName}
            onChange={(e) => setBorrowerName(e.target.value)}
            placeholder={DIRECTION_COPY[direction].namePlaceholder}
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
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            aria-label="Currency"
            className="px-3 py-2 rounded bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-orange-500/50"
          >
            {CURRENCIES.map((cur) => (
              <option key={cur} value={cur} className="bg-gray-900">
                {cur}
              </option>
            ))}
          </select>
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
            className="md:col-span-4 px-3 py-2 rounded bg-white/5 border border-white/10 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/50 resize-y"
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
                onDelete={() => requestDelete(entry)}
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
                onDelete={() => requestDelete(entry)}
                muted
              />
            ))}
          </ul>
        </section>
      )}

      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={dismissDelete}
          role="dialog"
          aria-modal="true"
          aria-labelledby="loan-delete-heading"
        >
          <FocusTrappedDiv
            className="bg-gray-900 border border-white/10 rounded-lg p-6 max-w-sm w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="loan-delete-heading" className="text-lg font-semibold text-white mb-2">
              Delete loan to {deleteTarget.borrowerName}?
            </h3>
            <p className="text-sm text-gray-400 mb-4">
              This removes the loan permanently. Cannot be undone.
            </p>
            {deleteError && (
              <p role="alert" className="mb-4 text-sm text-red-400">{deleteError}</p>
            )}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={dismissDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm bg-white/5 hover:bg-white/10 disabled:opacity-50 text-gray-400 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded transition-colors"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </FocusTrappedDiv>
        </div>
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
        <div className="flex items-baseline gap-3 flex-wrap">
          <span className="font-medium text-white truncate">{entry.borrowerName}</span>
          <span className="text-sm text-gray-400">
            {formatAmount(entry.amount, entry.currency)}
          </span>
          <span
            className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${
              entry.direction === "i_owe"
                ? "bg-sky-500/15 text-sky-300"
                : "bg-orange-500/15 text-orange-300"
            }`}
          >
            {DIRECTION_COPY[entry.direction].badge}
          </span>
        </div>
        {entry.description && (
          <div className="text-xs text-gray-400 mt-1 whitespace-pre-wrap">
            {entry.description}
          </div>
        )}
        <div className="text-xs text-gray-500 mt-1">
          {DIRECTION_COPY[entry.direction].verb} <RelativeTime iso={entry.createdAt} />
          {entry.repaidAt && (
            <>
              {" · repaid "}
              <RelativeTime iso={entry.repaidAt} />
            </>
          )}
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
  const [currency, setCurrency] = useState(entry.currency);
  const [description, setDescription] = useState(entry.description ?? "");
  const [direction, setDirection] = useState<LoanDirection>(entry.direction);
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Include the loan's existing currency if it isn't one of the curated codes
  // (e.g. set via the API to an exotic ISO 4217 code) so editing never silently
  // overwrites it.
  const currencyOptions = CURRENCIES.includes(entry.currency as (typeof CURRENCIES)[number])
    ? CURRENCIES
    : [entry.currency, ...CURRENCIES];

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
    if (currency !== entry.currency) patch.currency = currency;
    if (trimmedDesc !== currentDesc) patch.description = trimmedDesc.length > 0 ? trimmedDesc : null;
    if (direction !== entry.direction) patch.direction = direction;

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
        <div
          role="group"
          aria-label="Loan direction"
          className="inline-flex rounded-lg border border-white/10 p-0.5 bg-white/5"
        >
          {(["owed_to_me", "i_owe"] as LoanDirection[]).map((dir) => (
            <button
              key={dir}
              type="button"
              onClick={() => setDirection(dir)}
              aria-pressed={direction === dir}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                direction === dir
                  ? "bg-orange-500/90 text-white"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {dir === "owed_to_me" ? "They owe me" : "I owe them"}
            </button>
          ))}
        </div>
        <div className="grid gap-2 sm:grid-cols-[1fr_140px_100px]">
          <input
            value={borrowerName}
            onChange={(e) => setBorrowerName(e.target.value)}
            placeholder={DIRECTION_COPY[direction].namePlaceholder}
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
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            aria-label="Currency"
            className="px-3 py-2 rounded bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-orange-500/50"
          >
            {currencyOptions.map((cur) => (
              <option key={cur} value={cur} className="bg-gray-900">
                {cur}
              </option>
            ))}
          </select>
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
