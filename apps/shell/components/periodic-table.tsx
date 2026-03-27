"use client";

import { motion } from "framer-motion";
import type { ElementConfig } from "@shane/types";
import { ElementCard } from "./element-card";

interface PeriodicTableProps {
  elements: ElementConfig[];
}

export function PeriodicTable({ elements }: PeriodicTableProps) {
  const maxRow = Math.max(...elements.map((e) => e.rowPos));
  const maxCol = Math.max(...elements.map((e) => e.colPos));

  // Build grid: grid[row][col] = element | null
  const grid: (ElementConfig | null)[][] = Array.from({ length: maxRow }, () =>
    Array(maxCol).fill(null)
  );
  for (const el of elements) {
    grid[el.rowPos - 1][el.colPos - 1] = el;
  }

  const containerVariants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: 0.08,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30, scale: 0.85 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { type: "spring", stiffness: 260, damping: 20 },
    },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="flex flex-col gap-4"
    >
      {grid.map((row, rowIdx) => (
        <div key={rowIdx} className="flex gap-4">
          {row.map((element, colIdx) => (
            <motion.div key={colIdx} variants={itemVariants}>
              {element ? (
                <ElementCard element={element} />
              ) : (
                <div className="w-24 h-24" />
              )}
            </motion.div>
          ))}
        </div>
      ))}
    </motion.div>
  );
}
