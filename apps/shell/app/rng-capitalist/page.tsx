"use client";

import { useEffect, useState } from "react";
import { BudgetBar } from "@/components/rng/budget-bar";
import { UrlInput } from "@/components/rng/url-input";
import { ResultCard } from "@/components/rng/result-card";
import { HistoryList } from "@/components/rng/history-list";
import { BanList } from "@/components/rng/ban-list";
import { fetchBudget, fetchHistory, fetchBans, evaluateProduct, type BudgetInfo, type EvaluationResult, type Decision, type Ban } from "@/lib/rng-api";

export default function RngCapitalistPage() {
  const [budget, setBudget] = useState<BudgetInfo | null>(null);
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [history, setHistory] = useState<Decision[]>([]);
  const [bans, setBans] = useState<Ban[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchBudget().then(setBudget).catch(console.error);
    fetchHistory().then(setHistory).catch(console.error);
    fetchBans().then(setBans).catch(console.error);
  }, []);

  async function handleEvaluate(url: string) {
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await evaluateProduct(url);
      setResult(res);
      fetchHistory().then(setHistory).catch(console.error);
      fetchBans().then(setBans).catch(console.error);
      fetchBudget().then(setBudget).catch(console.error);
    } catch (err: any) { setError(err.message); } finally { setLoading(false); }
  }

  return (
    <div className="space-y-8">
      <BudgetBar budget={budget} />
      <UrlInput onSubmit={handleEvaluate} loading={loading} />
      {error && <p className="text-red-400 text-sm">{error}</p>}
      {result && <ResultCard result={result} />}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2"><HistoryList decisions={history} /></div>
        <div><BanList bans={bans} /></div>
      </div>
    </div>
  );
}
