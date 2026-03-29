"use client";

import { useEffect, useState, useRef } from "react";
import { BudgetBar } from "@/components/rng/budget-bar";
import { UrlInput } from "@/components/rng/url-input";
import { ResultCard } from "@/components/rng/result-card";
import { HistoryList } from "@/components/rng/history-list";
import { BanList } from "@/components/rng/ban-list";
import { fetchBudget, fetchHistory, fetchBans, evaluateProduct, evaluateManual, type BudgetInfo, type EvaluationResult, type Decision, type Ban } from "@/lib/rng-api";

export default function RngCapitalistPage() {
  const [budget, setBudget] = useState<BudgetInfo | null>(null);
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [history, setHistory] = useState<Decision[]>([]);
  const [bans, setBans] = useState<Ban[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsManual, setNeedsManual] = useState(false);

  // Track if user has manually overridden the budget
  const manualOverride = useRef<{ balance: number; lastMonthSpend: number } | null>(null);

  useEffect(() => {
    fetchBudget().then(setBudget).catch(console.error);
    fetchHistory().then(setHistory).catch(console.error);
    fetchBans().then(setBans).catch(console.error);
  }, []);

  function refreshAfterEval() {
    fetchHistory().then(setHistory).catch(console.error);
    fetchBans().then(setBans).catch(console.error);
    // Only refresh budget from Plaid if NOT manually overridden
    if (!manualOverride.current) {
      fetchBudget().then(setBudget).catch(console.error);
    }
  }

  // Build override params to send to backend
  function getOverrideParams(): { override_balance?: number; override_last_month_spend?: number } {
    if (!manualOverride.current) return {};
    return {
      override_balance: manualOverride.current.balance,
      override_last_month_spend: manualOverride.current.lastMonthSpend,
    };
  }

  async function handleEvaluateUrl(url: string) {
    setLoading(true); setError(null); setResult(null); setNeedsManual(false);
    try {
      const res = await evaluateProduct(url, getOverrideParams());
      setResult(res);
      refreshAfterEval();
    } catch (err: any) {
      if (err.needsManual) {
        setNeedsManual(true);
        setError(err.message);
      } else {
        setError(err.message);
      }
    } finally { setLoading(false); }
  }

  async function handleEvaluateManual(productName: string, price: number) {
    setLoading(true); setError(null); setResult(null); setNeedsManual(false);
    try {
      const res = await evaluateManual(productName, price, getOverrideParams());
      setResult(res);
      refreshAfterEval();
    } catch (err: any) { setError(err.message); } finally { setLoading(false); }
  }

  return (
    <div className="space-y-8">
      <BudgetBar
        budget={budget}
        onRefresh={() => {
          manualOverride.current = null;
          fetchBudget().then(setBudget);
        }}
        onManualOverride={(balance, lastMonthSpend) => {
          manualOverride.current = { balance, lastMonthSpend };
          setBudget({ connected: true, balance, last_month_spend: lastMonthSpend, remaining_budget: balance - lastMonthSpend });
        }}
      />
      <UrlInput
        onSubmitUrl={handleEvaluateUrl}
        onSubmitManual={handleEvaluateManual}
        loading={loading}
        showManualFallback={needsManual}
      />
      {error && !needsManual && <p className="text-red-400 text-sm">{error}</p>}
      {result && <ResultCard result={result} />}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2"><HistoryList decisions={history} /></div>
        <div><BanList bans={bans} /></div>
      </div>
    </div>
  );
}
