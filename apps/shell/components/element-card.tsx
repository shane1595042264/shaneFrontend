"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { ElementConfig } from "@shane/types";
import { CATEGORY_STYLES } from "@/lib/elements";

interface ElementCardProps {
  element: ElementConfig;
}

const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.85 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 260, damping: 20 },
  },
};

export function ElementCard({ element }: ElementCardProps) {
  const styles = CATEGORY_STYLES[element.category] || CATEGORY_STYLES["projects"];
  const isComingSoon = element.status === "coming-soon";

  const cardContent = (
    <motion.div
      variants={itemVariants}
      whileHover={isComingSoon ? {} : { scale: 1.08, y: -2, zIndex: 10 }}
      whileTap={isComingSoon ? {} : { scale: 0.95 }}
      className={[
        "relative flex flex-col items-center justify-between p-1 md:p-1.5 rounded border cursor-grab active:cursor-grabbing select-none w-full aspect-square transition-shadow",
        styles.bg,
        styles.border,
        isComingSoon ? "opacity-50 cursor-not-allowed" : "hover:shadow-lg hover:shadow-black/40",
      ].join(" ")}
    >
      {element.type === "external" && !isComingSoon && (
        <span className="absolute top-0 right-0.5 text-[7px] md:text-[9px] opacity-60">
          ↗
        </span>
      )}

      <span className="text-[7px] md:text-[9px] opacity-50 self-start leading-none">
        {element.rowPos}-{element.colPos}
      </span>

      <span
        className={`text-sm md:text-xl font-bold text-center leading-none ${styles.text}`}
      >
        {element.symbol}
      </span>

      <span className="text-[6px] md:text-[9px] text-center text-gray-300 truncate w-full leading-none">
        {element.name}
      </span>
    </motion.div>
  );

  // Wrap in link only when not being dragged (links are handled by click, not drag)
  if (isComingSoon) {
    return cardContent;
  }

  if (element.type === "external" && element.url) {
    return (
      <a
        href={element.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => {
          // Prevent navigation during drag
          if (e.defaultPrevented) return;
        }}
        draggable={false}
      >
        {cardContent}
      </a>
    );
  }

  return (
    <Link href={element.route || "/"} draggable={false}>
      {cardContent}
    </Link>
  );
}
