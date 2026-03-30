"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface DiceRollerProps {
  finalRoll: number;
  threshold: number;
  onComplete: () => void;
}

export function DiceRoller({ finalRoll, threshold, onComplete }: DiceRollerProps) {
  const [displayNumber, setDisplayNumber] = useState(1);
  const [phase, setPhase] = useState<"rolling" | "landed">("rolling");

  const handleAnimationDone = useCallback(() => {
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    if (phase !== "rolling") return;

    // Cycle through random numbers rapidly
    const interval = setInterval(() => {
      setDisplayNumber(Math.floor(Math.random() * 20) + 1);
    }, 60);

    // After 1.2s, land on the final number
    const timer = setTimeout(() => {
      clearInterval(interval);
      setDisplayNumber(finalRoll);
      setPhase("landed");
    }, 1200);

    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, [phase, finalRoll]);

  // Notify parent after the landing animation settles
  useEffect(() => {
    if (phase !== "landed") return;
    const timer = setTimeout(handleAnimationDone, 600);
    return () => clearTimeout(timer);
  }, [phase, handleAnimationDone]);

  const passed = finalRoll >= threshold;

  return (
    <div className="flex items-center gap-4 mt-3">
      <div className="relative">
        <AnimatePresence mode="wait">
          {phase === "rolling" ? (
            <motion.div
              key="rolling"
              className="w-14 h-14 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center"
              animate={{
                rotate: [0, 10, -10, 8, -8, 5, -5, 0],
                scale: [1, 1.05, 0.95, 1.03, 0.97, 1],
              }}
              transition={{
                duration: 0.4,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <span className="text-xl font-mono font-bold text-white/70">
                {displayNumber}
              </span>
            </motion.div>
          ) : (
            <motion.div
              key="landed"
              className={`w-14 h-14 rounded-lg flex items-center justify-center border ${
                passed
                  ? "bg-green-500/20 border-green-500/50"
                  : "bg-red-500/20 border-red-500/50"
              }`}
              initial={{ scale: 1.3, rotate: 15 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 15 }}
            >
              <span
                className={`text-xl font-mono font-bold ${
                  passed ? "text-green-400" : "text-red-400"
                }`}
              >
                {displayNumber}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex flex-col text-sm">
        <span className="text-gray-400">
          Need{" "}
          <span className="text-white font-mono">{threshold}+</span> on D20
        </span>
        {phase === "landed" && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`font-semibold ${passed ? "text-green-400" : "text-red-400"}`}
          >
            Rolled {finalRoll} — {passed ? "Pass!" : "Fail"}
          </motion.span>
        )}
      </div>
    </div>
  );
}
