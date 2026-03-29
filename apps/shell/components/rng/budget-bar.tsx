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
}

export function BudgetBar({ budget, onRefresh }: BudgetBarProps) {
  if (!budget) return <div className="text-gray-600 text-sm">Loading budget...</div>;

  if (!budget.connected) {
    return (
      <div className="bg-white/5 rounded-lg p-6 text-center">
        <p className="text-gray-400 mb-3">Connect your bank to get started</p>
        <PlaidConnectButton onConnected={() => onRefresh?.()} />
      </div>
    );
  }

  const remaining = budget.remaining_budget ?? 0;
  return (
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
  );
}
