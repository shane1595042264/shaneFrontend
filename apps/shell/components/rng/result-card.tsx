"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { EvaluationResult } from "@/lib/rng-api";
import { DiceRoller } from "./dice-roller";

const VERDICT_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  approved: { bg: "bg-green-500/20 border-green-500/50", text: "text-green-400", label: "APPROVED" },
  denied: { bg: "bg-red-500/20 border-red-500/50", text: "text-red-400", label: "DENIED" },
  necessity: { bg: "bg-blue-500/20 border-blue-500/50", text: "text-blue-400", label: "NECESSITY" },
  banned: { bg: "bg-red-500/20 border-red-500/50", text: "text-red-400", label: "BANNED" },
  too_expensive: { bg: "bg-red-500/20 border-red-500/50", text: "text-red-400", label: "TOO EXPENSIVE" },
};

// Results that skip the dice roll (no roll involved)
const SKIP_DICE = new Set(["necessity", "banned", "too_expensive"]);

export function ResultCard({ result }: { result: EvaluationResult }) {
  const hasDice = result.threshold !== null && result.roll !== null && !SKIP_DICE.has(result.result);
  const [verdictRevealed, setVerdictRevealed] = useState(!hasDice);
  const style = VERDICT_STYLES[result.result] || VERDICT_STYLES.denied;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={`rounded-lg border p-6 ${verdictRevealed ? style.bg : "bg-white/5 border-white/10"}`}>
      <div className="flex gap-4">
        {result.avatar_url && <img src={result.avatar_url} alt={result.product_name} className="w-20 h-20 rounded-lg object-cover flex-shrink-0" />}
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-white truncate">{result.product_name}</h3>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-white font-bold">${result.price.toFixed(2)}</span>
            <span className="text-xs bg-white/10 px-2 py-0.5 rounded text-gray-300">{result.generic_category}</span>
          </div>
          {hasDice && (
            <DiceRoller
              finalRoll={result.roll!}
              threshold={result.threshold!}
              onComplete={() => setVerdictRevealed(true)}
            />
          )}
          <AnimatePresence>
            {verdictRevealed && (
              <motion.div
                className="mt-3"
                initial={hasDice ? { opacity: 0, y: 10 } : false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <span className={`text-2xl font-black ${style.text}`}>{style.label}</span>
                {result.result === "denied" && result.banned_until && <p className="text-sm text-gray-400 mt-1">Category &quot;{result.generic_category}&quot; banned for 30 days</p>}
                {result.result === "banned" && result.banned_until && <p className="text-sm text-gray-400 mt-1">Banned until {new Date(result.banned_until).toLocaleDateString()}</p>}
                {result.result === "necessity" && <p className="text-sm text-gray-400 mt-1">Necessities are auto-approved</p>}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
