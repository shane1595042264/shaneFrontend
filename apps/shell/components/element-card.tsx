"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { ElementConfig } from "@shane/types";
import { CATEGORY_STYLES } from "@/lib/elements";

interface ElementCardProps {
  element: ElementConfig;
  atomicNumber: number;
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

export function ElementCard({ element, atomicNumber }: ElementCardProps) {
  const styles = CATEGORY_STYLES[element.category] || CATEGORY_STYLES["projects"];
  const isComingSoon = element.status === "coming-soon";
  const isExternal = element.type === "external";
  const tooltipText = isComingSoon ? "Coming soon" : element.description || null;

  const ariaLabel = isComingSoon
    ? `${element.name} (${element.symbol}) — coming soon`
    : isExternal
      ? `${element.name} (${element.symbol}) — opens in a new tab`
      : `${element.name} (${element.symbol}) — open page`;

  const cardContent = (
    <motion.div
      variants={itemVariants}
      whileHover={isComingSoon ? {} : { scale: 1.08, y: -2, zIndex: 10 }}
      whileTap={isComingSoon ? {} : { scale: 0.95 }}
      className={[
        "group/card relative flex flex-col items-center justify-between p-1 md:p-1.5 rounded border cursor-grab active:cursor-grabbing select-none w-full aspect-square transition-shadow",
        styles.bg,
        styles.border,
        isComingSoon ? "opacity-50 cursor-not-allowed" : "hover:shadow-lg hover:shadow-black/40",
      ].join(" ")}
    >
      {tooltipText && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden md:block opacity-0 group-hover/card:opacity-100 transition-opacity duration-150 z-50 whitespace-nowrap rounded bg-gray-900 border border-white/10 px-2 py-1 text-[10px] text-gray-200 shadow-lg"
        >
          {tooltipText}
        </span>
      )}

      {isComingSoon && (
        <span
          aria-hidden="true"
          className="absolute top-0 right-0 text-[5px] md:text-[7px] opacity-40 font-medium tracking-tight text-gray-400"
        >
          SOON
        </span>
      )}

      {isExternal && !isComingSoon && (
        <span
          aria-hidden="true"
          className="absolute top-0 right-0.5 text-[7px] md:text-[9px] opacity-60"
        >
          ↗
        </span>
      )}

      <span
        aria-hidden="true"
        className="text-[7px] md:text-[9px] opacity-50 self-start leading-none"
      >
        {atomicNumber}
      </span>

      <span
        aria-hidden="true"
        className={`text-sm md:text-xl font-bold text-center leading-none ${styles.text}`}
      >
        {element.symbol}
      </span>

      <span
        aria-hidden="true"
        className="text-[6px] md:text-[9px] text-center text-gray-300 truncate w-full leading-none"
      >
        {element.name}
      </span>
    </motion.div>
  );

  if (isComingSoon) {
    return (
      <div role="img" aria-label={ariaLabel} aria-disabled="true">
        {cardContent}
      </div>
    );
  }

  if (isExternal && element.url) {
    return (
      <a
        href={element.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={ariaLabel}
        onClick={(e) => {
          if (e.defaultPrevented) return;
        }}
        draggable={false}
      >
        {cardContent}
      </a>
    );
  }

  return (
    <Link href={element.route || "/"} aria-label={ariaLabel} draggable={false}>
      {cardContent}
    </Link>
  );
}
