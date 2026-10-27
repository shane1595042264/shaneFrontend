"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { BudgetBar } from "@/components/rng/budget-bar";
import { UrlInput } from "@/components/rng/url-input";
import { ResultCard } from "@/components/rng/result-card";
import { HistoryList } from "@/components/rng/history-list";
import { BanList } from "@/components/rng/ban-list";
import { fetchBudget, fetchHistory, fetchBans, evaluateProduct, evaluateManual, type BudgetInfo, type EvaluationResult, type Decision, type Ban } from "@/lib/rng-api";
import { AuthGate } from "@/components/auth-gate";
import { useAuth } from "@/lib/auth-context";

export default function RngCapitalistPage() {
  return (
    <AuthGate>
      <RngCapitalistContent />
    </AuthGate>
  );
}

function RngCapitalistContent() {
  const { user } = useAuth();
  const [budget, setBudget] = useState<BudgetInfo | null>(null);
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [history, setHistory] = useState<Decision[]>([]);
  const [bans, setBans] = useState<Ban[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsManual, setNeedsManual] = useState(false);
  // SHAN-621: one error per section, so a failed fetch renders as a failure in
  // that section instead of its empty state ("No active bans.") or a budget
  // that says "Loading budget..." forever.
  const [budgetError, setBudgetError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [bansError, setBansError] = useState<string | null>(null);

  // Track if user has manually overridden the budget
  const manualOverride = useRef<{ balance: number; lastMonthSpend: number } | null>(null);

  // `replaceOverride` is for an explicit refresh (a bank was just connected):
  // the fresh Plaid numbers win, and only once they have actually landed, so a
  // failed fetch keeps the manual numbers the evaluations are using. Any other
  // load leaves an override that was entered while it was in flight alone.
  const loadBudget = useCallback((replaceOverride = false) => {
    setBudgetError(null);
    return fetchBudget()
      .then((b) => {
        if (manualOverride.current && !replaceOverride) return;
        manualOverride.current = null;
        setBudget(b);
      })
      .catch(() => {
        if (manualOverride.current && !replaceOverride) return;
        setBudgetError("Couldn't load your budget.");
      });
  }, []);

  const loadHistory = useCallback(() => {
    setHistoryError(null);
    return fetchHistory()
      .then(setHistory)
      .catch(() => setHistoryError("Couldn't load your history."));
  }, []);

  const loadBans = useCallback(() => {
    setBansError(null);
    return fetchBans()
      .then(setBans)
      .catch(() => setBansError("Couldn't load your bans."));
  }, []);

  // Re-fetch data when user changes (login/logout)
  useEffect(() => {
    if (!user) return;
    loadBudget();
    loadHistory();
    loadBans();
  }, [user, loadBudget, loadHistory, loadBans]);

  function refreshAfterEval() {
    loadHistory();
    loadBans();
    // Only refresh budget from Plaid if NOT manually overridden
    if (!manualOverride.current) loadBudget();
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
        error={budgetError}
        onRetry={() => loadBudget()}
        onRefresh={() => loadBudget(true)}
        onManualOverride={(balance, lastMonthSpend) => {
          manualOverride.current = { balance, lastMonthSpend };
          setBudgetError(null);
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
        <div className="md:col-span-2"><HistoryList decisions={history} error={historyError} onRetry={loadHistory} /></div>
        <div><BanList bans={bans} error={bansError} onRetry={loadBans} /></div>
      </div>
    </div>
  );
}
