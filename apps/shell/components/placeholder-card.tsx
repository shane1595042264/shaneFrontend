"use client";

import { motion } from "framer-motion";
import type { ChemicalElement } from "@/lib/periodic-table-data";

interface PlaceholderCardProps {
  element: ChemicalElement;
}

const itemVariants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { type: "spring", stiffness: 300, damping: 25 },
  },
};

export function PlaceholderCard({ element }: PlaceholderCardProps) {
  const ariaLabel = `Empty slot — atomic number ${element.atomicNumber}, ${element.name} (${element.symbol})`;

  return (
    <div role="img" aria-label={ariaLabel} aria-disabled="true">
      <motion.div
        variants={itemVariants}
        className="flex flex-col items-center justify-between p-1 rounded border border-gray-700/40 bg-gray-900/30 w-full aspect-square select-none cursor-default opacity-30"
      >
        <span aria-hidden="true" className="text-[7px] md:text-[9px] text-gray-500 self-start leading-none">
          {element.atomicNumber}
        </span>
        <span aria-hidden="true" className="text-xs md:text-sm font-semibold text-gray-500 leading-none">
          {element.symbol}
        </span>
        <span aria-hidden="true" className="text-[6px] md:text-[8px] text-gray-600 truncate w-full text-center leading-none">
          {element.name}
        </span>
      </motion.div>
    </div>
  );
}
