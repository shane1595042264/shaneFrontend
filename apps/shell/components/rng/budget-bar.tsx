"use client";

import { useState, useCallback } from "react";
import { usePlaidLink } from "react-plaid-link";
import type { BudgetInfo } from "@/lib/rng-api";
import { createPlaidLinkToken, exchangePlaidToken } from "@/lib/rng-api";

function formatMoney(n: number | null): string {
  if (n === null) return "—";
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function PlaidConnectButton({ onConnected }: { onConnected: () => void }) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleGetToken() {
    setLoading(true);
    try {
      const token = await createPlaidLinkToken();
      setLinkToken(token);
    } catch (err) {
      console.error("Failed to create link token:", err);
    } finally {
      setLoading(false);
    }
  }

  const onSuccess = useCallback(
    async (publicToken: string) => {
      try {
        await exchangePlaidToken(publicToken);
        onConnected();
      } catch (err) {
        console.error("Failed to exchange token:", err);
      }
    },
    [onConnected]
  );

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
  });

  if (!linkToken) {
    return (
      <button
        onClick={handleGetToken}
        disabled={loading}
        className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 text-sm disabled:opacity-50"
      >
        {loading ? "Loading..." : "Connect Bank"}
      </button>
    );
  }

  return (
    <button
      onClick={() => open()}
      disabled={!ready}
      className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 text-sm disabled:opacity-50"
    >
      {ready ? "Connect Bank" : "Loading..."}
    </button>
  );
}

interface BudgetBarProps {
  budget: BudgetInfo | null;
  onRefresh?: () => void;
  onManualOverride?: (balance: number, lastMonthSpend: number) => void;
}

export function BudgetBar({ budget, onRefresh, onManualOverride }: BudgetBarProps) {
  const [editing, setEditing] = useState(false);
  const [manualBalance, setManualBalance] = useState("");
  const [manualSpend, setManualSpend] = useState("");

  if (!budget) return <div className="text-gray-600 text-sm">Loading budget...</div>;

  if (!budget.connected && !editing) {
    return (
      <div className="bg-white/5 rounded-lg p-6 text-center space-y-3">
        <p className="text-gray-400">Connect your bank or enter manually</p>
        <div className="flex items-center justify-center gap-3">
          <PlaidConnectButton onConnected={() => onRefresh?.()} />
          <button
            onClick={() => setEditing(true)}
            className="px-4 py-2 border border-white/20 text-gray-300 rounded-md hover:bg-white/10 text-sm"
          >
            Enter Manually
          </button>
        </div>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="bg-white/5 rounded-lg p-4">
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1">Balance</label>
            <input
              type="number"
              step="0.01"
              value={manualBalance}
              onChange={(e) => setManualBalance(e.target.value)}
              placeholder="2000.00"
              className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1">Last Month Spend</label>
            <input
              type="number"
              step="0.01"
              value={manualSpend}
              onChange={(e) => setManualSpend(e.target.value)}
              placeholder="1000.00"
              className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500"
            />
          </div>
          <button
            onClick={() => {
              const b = parseFloat(manualBalance);
              const s = parseFloat(manualSpend);
              if (!isNaN(b) && !isNaN(s)) {
                onManualOverride?.(b, s);
                setEditing(false);
              }
            }}
            disabled={!manualBalance || !manualSpend}
            className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 text-sm disabled:opacity-50"
          >
            Save
          </button>
          <button
            onClick={() => setEditing(false)}
            className="px-4 py-2 text-gray-400 hover:text-white text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  const remaining = budget.remaining_budget ?? 0;
  return (
    <div>
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white/5 rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Balance</p>
          <p className="text-2xl font-bold text-white mt-1">{formatMoney(budget.balance)}</p>
        </div>
        <div className="bg-white/5 rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Last Month Spend</p>
          <p className="text-2xl font-bold text-gray-300 mt-1">{formatMoney(budget.last_month_spend)}</p>
        </div>
        <div className="bg-white/5 rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Remaining Budget</p>
          <p className={`text-2xl font-bold mt-1 ${remaining < 0 ? "text-red-400" : "text-green-400"}`}>
            {formatMoney(budget.remaining_budget)}
          </p>
        </div>
      </div>
      <button
        onClick={() => setEditing(true)}
        className="mt-2 text-xs text-gray-600 hover:text-gray-400 transition-colors"
      >
        Override manually
      </button>
    </div>
  );
}
