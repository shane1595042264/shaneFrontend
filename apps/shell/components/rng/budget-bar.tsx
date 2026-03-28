"use client";
import type { BudgetInfo } from "@/lib/rng-api";

function formatMoney(n: number | null): string {
  if (n === null) return "—";
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function BudgetBar({ budget }: { budget: BudgetInfo | null }) {
  if (!budget) return <div className="text-gray-600 text-sm">Loading budget...</div>;
  if (!budget.connected) {
    return (
      <div className="bg-white/5 rounded-lg p-6 text-center">
        <p className="text-gray-400 mb-3">Connect your bank to get started</p>
        <button className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 text-sm">Connect Bank</button>
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
        <p className={`text-2xl font-bold mt-1 ${remaining < 0 ? "text-red-400" : "text-green-400"}`}>{formatMoney(budget.remaining_budget)}</p>
      </div>
    </div>
  );
}
