"use client";
import { motion } from "framer-motion";
import type { EvaluationResult } from "@/lib/rng-api";

const VERDICT_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  approved: { bg: "bg-green-500/20 border-green-500/50", text: "text-green-400", label: "APPROVED" },
  denied: { bg: "bg-red-500/20 border-red-500/50", text: "text-red-400", label: "DENIED" },
  necessity: { bg: "bg-blue-500/20 border-blue-500/50", text: "text-blue-400", label: "NECESSITY" },
  banned: { bg: "bg-red-500/20 border-red-500/50", text: "text-red-400", label: "BANNED" },
  too_expensive: { bg: "bg-red-500/20 border-red-500/50", text: "text-red-400", label: "TOO EXPENSIVE" },
};

export function ResultCard({ result }: { result: EvaluationResult }) {
  const style = VERDICT_STYLES[result.result] || VERDICT_STYLES.denied;
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className={`rounded-lg border p-6 ${style.bg}`}>
      <div className="flex gap-4">
        {result.avatar_url && <img src={result.avatar_url} alt={result.product_name} className="w-20 h-20 rounded-lg object-cover flex-shrink-0" />}
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-white truncate">{result.product_name}</h3>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-white font-bold">${result.price.toFixed(2)}</span>
            <span className="text-xs bg-white/10 px-2 py-0.5 rounded text-gray-300">{result.generic_category}</span>
          </div>
          {result.threshold !== null && result.roll !== null && (
            <div className="flex items-center gap-4 mt-3 text-sm">
              <span className="text-gray-400">Threshold: <span className="text-white font-mono">D{result.threshold}</span></span>
              <span className="text-gray-400">Roll: <span className="text-white font-mono">{result.roll}</span></span>
            </div>
          )}
          <div className="mt-3">
            <span className={`text-2xl font-black ${style.text}`}>{style.label}</span>
            {result.result === "denied" && result.banned_until && <p className="text-sm text-gray-400 mt-1">Category &quot;{result.generic_category}&quot; banned for 30 days</p>}
            {result.result === "banned" && result.banned_until && <p className="text-sm text-gray-400 mt-1">Banned until {new Date(result.banned_until).toLocaleDateString()}</p>}
            {result.result === "necessity" && <p className="text-sm text-gray-400 mt-1">Necessities are auto-approved</p>}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
