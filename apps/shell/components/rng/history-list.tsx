"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Decision } from "@/lib/rng-api";

const RESULT_BADGE: Record<string, string> = {
  approved: "bg-green-500/20 text-green-400",
  denied: "bg-red-500/20 text-red-400",
  necessity: "bg-blue-500/20 text-blue-400",
  banned: "bg-red-500/20 text-red-400",
  too_expensive: "bg-red-500/20 text-red-400",
};

const RESULT_LABELS: Record<string, string> = {
  approved: "Approved",
  denied: "Denied",
  necessity: "Necessity",
  banned: "Banned",
  too_expensive: "Too Expensive",
};

function formatMoney(n: number | null): string {
  if (n === null) return "—";
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function HistoryItem({ decision }: { decision: Decision }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white/5 rounded-lg overflow-hidden">
      {/* Summary row — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-white/5 transition-colors"
      >
        {decision.avatarUrl && (
          <img src={decision.avatarUrl} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          {decision.url ? (
            <a
              href={decision.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-sm text-blue-400 hover:text-blue-300 hover:underline truncate block"
            >
              {decision.productName}
            </a>
          ) : (
            <p className="text-sm text-white truncate">{decision.productName}</p>
          )}
          <p className="text-xs text-gray-500">
            ${decision.price.toFixed(2)} &middot; {decision.genericCategory}
          </p>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded font-medium flex-shrink-0 ${RESULT_BADGE[decision.result] || ""}`}>
          {RESULT_LABELS[decision.result] || decision.result}
        </span>
        <span className="hidden sm:inline text-xs text-gray-600 flex-shrink-0">
          {new Date(decision.createdAt).toLocaleDateString()}
        </span>
        <span className="text-gray-600 text-xs flex-shrink-0">{expanded ? "▴" : "▾"}</span>
      </button>

      {/* Expanded details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-1 border-t border-white/5 text-xs space-y-2">
              {/* Calculation breakdown */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-gray-400">
                <div>Balance at time:</div>
                <div className="text-white">{formatMoney(decision.balanceAtTime)}</div>

                <div>Remaining budget:</div>
                <div className={decision.remainingBudget !== null && decision.remainingBudget < 0 ? "text-red-400" : "text-white"}>
                  {formatMoney(decision.remainingBudget)}
                </div>

                {decision.isEntertainment && (
                  <>
                    <div>Category:</div>
                    <div className="text-orange-400">Entertainment</div>
                  </>
                )}

                {!decision.isEntertainment && (
                  <>
                    <div>Category:</div>
                    <div className="text-blue-400">Necessity (auto-approved)</div>
                  </>
                )}

                {decision.threshold !== null && (
                  <>
                    <div>Threshold:</div>
                    <div className="text-white">
                      D{decision.threshold}
                      <span className="text-gray-500 ml-1">
                        ({decision.price.toFixed(2)} / {formatMoney(decision.remainingBudget)} &times; 20)
                      </span>
                    </div>
                  </>
                )}

                {decision.roll !== null && (
                  <>
                    <div>D20 Roll:</div>
                    <div className={decision.roll >= (decision.threshold ?? 0) ? "text-green-400" : "text-red-400"}>
                      {decision.roll}
                      {decision.threshold !== null && (
                        <span className="text-gray-500 ml-1">
                          (needed {decision.threshold}+)
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Date (shown inline above on >=sm, here on mobile) */}
              <div className="sm:hidden text-gray-500">
                {new Date(decision.createdAt).toLocaleString()}
              </div>

              {/* Verdict explanation */}
              <div className="pt-1 border-t border-white/5 text-gray-400">
                {decision.result === "approved" && "Roll met the threshold. Purchase approved."}
                {decision.result === "denied" && `Roll failed. Category "${decision.genericCategory}" banned for 30 days.`}
                {decision.result === "too_expensive" && "Threshold exceeds D20 (price is too high relative to remaining budget). Auto-denied."}
                {decision.result === "banned" && `Category "${decision.genericCategory}" is currently banned from a previous denial.`}
                {decision.result === "necessity" && "Necessities are auto-approved without a dice roll."}
              </div>

              {/* Link to product */}
              {decision.url && (
                <div className="pt-1 border-t border-white/5">
                  <a
                    href={decision.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 hover:underline break-all"
                  >
                    View product &rarr;
                  </a>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function HistoryList({ decisions }: { decisions: Decision[] }) {
  if (decisions.length === 0) {
    return (
      <div>
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">History</h3>
        <p className="text-gray-600 text-sm">No decisions yet.</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">History</h3>
      <div className="space-y-2">
        {decisions.map((d) => (
          <HistoryItem key={d.id} decision={d} />
        ))}
      </div>
    </div>
  );
}
