"use client";

import { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import type { ElementConfig } from "@shane/types";
import { ElementCard } from "./element-card";
import { PlaceholderCard } from "./placeholder-card";
import {
  PERIODIC_TABLE_ELEMENTS,
  GRID_ROWS,
  GRID_COLS,
  GAP_ROW,
  type ChemicalElement,
} from "@/lib/periodic-table-data";

interface PeriodicTableProps {
  elements: ElementConfig[];
}

const STORAGE_KEY = "periodic-table-positions";

function loadPositions(): Record<string, { row: number; col: number }> {
  if (typeof window === "undefined") return {};
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return {};
}

function savePositions(positions: Record<string, { row: number; col: number }>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
  } catch {}
}

export function PeriodicTable({ elements }: PeriodicTableProps) {
  // Build position overrides from localStorage
  const [positionOverrides, setPositionOverrides] = useState<
    Record<string, { row: number; col: number }>
  >({});
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  useEffect(() => {
    setPositionOverrides(loadPositions());
  }, [elements]);

  // Apply position overrides to elements
  const positionedElements = elements.map((el) => {
    const override = positionOverrides[el.id];
    if (override) {
      return { ...el, rowPos: override.row, colPos: override.col };
    }
    return el;
  });

  // Build lookup: "row-col" -> active element
  const activeMap = new Map<string, ElementConfig>();
  for (const el of positionedElements) {
    activeMap.set(`${el.rowPos}-${el.colPos}`, el);
  }

  // Build lookup: "row-col" -> chemical element
  const chemMap = new Map<string, ChemicalElement>();
  for (const ce of PERIODIC_TABLE_ELEMENTS) {
    chemMap.set(`${ce.row}-${ce.col}`, ce);
  }

  const handleDragStart = useCallback((elementId: string) => {
    setDraggedId(elementId);
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, cellKey: string) => {
      e.preventDefault();
      if (draggedId) setDropTarget(cellKey);
    },
    [draggedId]
  );

  const handleDragLeave = useCallback(() => {
    setDropTarget(null);
  }, []);

  const handleDrop = useCallback(
    (targetRow: number, targetCol: number) => {
      if (!draggedId) return;
      setDropTarget(null);

      const draggedEl = positionedElements.find((el) => el.id === draggedId);
      if (!draggedEl) return;

      // Check if there's an active element at the target
      const targetKey = `${targetRow}-${targetCol}`;
      const targetEl = activeMap.get(targetKey);

      const newOverrides = { ...positionOverrides };

      if (targetEl && targetEl.id !== draggedId) {
        // Swap: move target element to dragged element's old position
        newOverrides[targetEl.id] = {
          row: draggedEl.rowPos,
          col: draggedEl.colPos,
        };
      }

      // Move dragged element to target position
      newOverrides[draggedId] = { row: targetRow, col: targetCol };

      setPositionOverrides(newOverrides);
      savePositions(newOverrides);
      setDraggedId(null);
    },
    [draggedId, positionedElements, activeMap, positionOverrides]
  );

  const handleDragEnd = useCallback(() => {
    setDraggedId(null);
    setDropTarget(null);
  }, []);

  // Build grid cells
  const cells: React.ReactNode[] = [];

  for (let row = 1; row <= GRID_ROWS; row++) {
    // Gap row — render a half-height spacer
    if (row === GAP_ROW) {
      cells.push(
        <div
          key="gap"
          style={{ gridRow: row, gridColumn: "1 / -1", height: "8px" }}
        />
      );
      continue;
    }

    for (let col = 1; col <= GRID_COLS; col++) {
      const cellKey = `${row}-${col}`;
      const activeEl = activeMap.get(cellKey);
      const chemEl = chemMap.get(cellKey);
      const isDropping = dropTarget === cellKey;

      if (activeEl) {
        // Active life element
        cells.push(
          <motion.div
            key={`active-${activeEl.id}`}
            layout
            layoutId={activeEl.id}
            style={{ gridRow: row, gridColumn: col }}
            className={`relative ${isDropping ? "ring-2 ring-white/50 rounded-md" : ""}`}
            draggable
            onDragStart={() => handleDragStart(activeEl.id)}
            onDragOver={(e) => handleDragOver(e as unknown as React.DragEvent, cellKey)}
            onDragLeave={handleDragLeave}
            onDrop={() => handleDrop(row, col)}
            onDragEnd={handleDragEnd}
          >
            <ElementCard element={activeEl} />
          </motion.div>
        );
      } else if (chemEl) {
        // Placeholder chemical element
        cells.push(
          <div
            key={`chem-${chemEl.atomicNumber}`}
            style={{ gridRow: row, gridColumn: col }}
            className={`${isDropping ? "ring-2 ring-white/50 rounded-md" : ""}`}
            onDragOver={(e) => handleDragOver(e as unknown as React.DragEvent, cellKey)}
            onDragLeave={handleDragLeave}
            onDrop={() => handleDrop(row, col)}
          >
            <PlaceholderCard element={chemEl} />
          </div>
        );
      }
      // Empty cells (no chemical element at this position) — skip, grid handles gaps
    }
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { duration: 0.5, staggerChildren: 0.01 },
    },
  };

  return (
    <div className="w-full overflow-x-auto pb-4">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="periodic-grid mx-auto"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${GRID_ROWS}, auto)`,
          gap: "2px",
          minWidth: "640px",
          maxWidth: "1100px",
        }}
      >
        {cells}
      </motion.div>
    </div>
  );
}
