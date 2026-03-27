"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { ElementConfig } from "@shane/types";
import { CATEGORY_STYLES } from "@/lib/elements";

interface ElementCardProps {
  element: ElementConfig;
}

export function ElementCard({ element }: ElementCardProps) {
  const styles = CATEGORY_STYLES[element.category];
  const isComingSoon = element.status === "coming-soon";

  const cardContent = (
    <motion.div
      whileHover={isComingSoon ? {} : { scale: 1.05, y: -4 }}
      whileTap={isComingSoon ? {} : { scale: 0.97 }}
      className={[
        "relative flex flex-col justify-between p-3 rounded-lg border-2 cursor-pointer select-none",
        "w-24 h-24 transition-shadow",
        styles.bg,
        styles.border,
        isComingSoon ? "opacity-40 cursor-not-allowed" : "hover:shadow-lg hover:shadow-black/40",
      ].join(" ")}
    >
      {/* External indicator */}
      {element.type === "external" && !isComingSoon && (
        <span className="absolute top-1.5 right-1.5 text-xs opacity-60">↗</span>
      )}

      {/* Atomic number placeholder (col/row) */}
      <span className="text-xs opacity-50">
        {element.rowPos}-{element.colPos}
      </span>

      {/* Symbol */}
      <span className={`text-3xl font-bold text-center leading-none ${styles.text}`}>
        {element.symbol}
      </span>

      {/* Name */}
      <span className="text-xs text-center text-gray-300 truncate">{element.name}</span>
    </motion.div>
  );

  if (isComingSoon) {
    return cardContent;
  }

  if (element.type === "external" && element.url) {
    return (
      <a href={element.url} target="_blank" rel="noopener noreferrer">
        {cardContent}
      </a>
    );
  }

  return (
    <Link href={element.route || "/"}>
      {cardContent}
    </Link>
  );
}
