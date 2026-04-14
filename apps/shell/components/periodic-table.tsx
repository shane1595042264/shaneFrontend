"use client";

import { useState, useCallback, useEffect, useRef } from "react";
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
import {
  type SlotMap,
  resolveSlots,
  saveSlotAssignments,
} from "@/lib/slot-assignments";

interface PeriodicTableProps {
  elements: ElementConfig[];
  initialAssignments?: SlotMap;
}

export function PeriodicTable({ elements, initialAssignments = {} }: PeriodicTableProps) {
  const [slotMap, setSlotMap] = useState<SlotMap>(() =>
    resolveSlots(elements, initialAssignments)
  );
  const [draggedAppId, setDraggedAppId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<number | null>(null);
  const [saveToast, setSaveToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    setSlotMap(resolveSlots(elements, initialAssignments));
  }, [elements, initialAssignments]);

  const appToSlot = new Map<string, number>();
  for (const [atomic, appId] of Object.entries(slotMap)) {
    appToSlot.set(appId, Number(atomic));
  }

  const appById = new Map<string, ElementConfig>();
  for (const el of elements) {
    appById.set(el.id, el);
  }

  const handleDragStart = useCallback((appId: string) => {
    setDraggedAppId(appId);
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, atomicNumber: number) => {
      e.preventDefault();
      if (draggedAppId) setDropTarget(atomicNumber);
    },
    [draggedAppId]
  );

  const handleDragLeave = useCallback(() => {
    setDropTarget(null);
  }, []);

  const handleDrop = useCallback(
    (targetAtomic: number) => {
      if (!draggedAppId) return;
      setDropTarget(null);

      const sourceAtomic = appToSlot.get(draggedAppId);
      if (sourceAtomic === undefined || sourceAtomic === targetAtomic) {
        setDraggedAppId(null);
        return;
      }

      const targetAppId = slotMap[targetAtomic];
      const newSlotMap = { ...slotMap };
      const previousSlotMap = { ...slotMap };

      if (targetAppId) {
        newSlotMap[sourceAtomic] = targetAppId;
      } else {
        delete newSlotMap[sourceAtomic];
      }

      newSlotMap[targetAtomic] = draggedAppId;

      setSlotMap(newSlotMap);
      setDraggedAppId(null);

      saveSlotAssignments(newSlotMap)
        .then(() => {
          setSaveToast({ type: "success", message: "Arrangement saved" });
          setTimeout(() => setSaveToast(null), 2000);
        })
        .catch(() => {
          setSlotMap(previousSlotMap);
          setSaveToast({ type: "error", message: "Failed to save arrangement" });
          setTimeout(() => setSaveToast(null), 4000);
        });
    },
    [draggedAppId, slotMap, appToSlot]
  );

  const handleDragEnd = useCallback(() => {
    setDraggedAppId(null);
    setDropTarget(null);
  }, []);

  const chemMap = new Map<string, ChemicalElement>();
  for (const ce of PERIODIC_TABLE_ELEMENTS) {
    chemMap.set(`${ce.row}-${ce.col}`, ce);
  }

  const cells: React.ReactNode[] = [];

  for (let row = 1; row <= GRID_ROWS; row++) {
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
      const chemEl = chemMap.get(cellKey);
      if (!chemEl) continue;

      const assignedAppId = slotMap[chemEl.atomicNumber];
      const assignedApp = assignedAppId ? appById.get(assignedAppId) : undefined;
      const isDropping = dropTarget === chemEl.atomicNumber;

      if (assignedApp) {
        cells.push(
          <motion.div
            key={`active-${assignedApp.id}`}
            layout
            layoutId={assignedApp.id}
            style={{ gridRow: row, gridColumn: col }}
            className={`relative ${isDropping ? "ring-2 ring-white/50 rounded-md" : ""}`}
            draggable
            onDragStart={() => handleDragStart(assignedApp.id)}
            onDragOver={(e) => handleDragOver(e as unknown as React.DragEvent, chemEl.atomicNumber)}
            onDragLeave={handleDragLeave}
            onDrop={() => handleDrop(chemEl.atomicNumber)}
            onDragEnd={handleDragEnd}
          >
            <ElementCard element={assignedApp} atomicNumber={chemEl.atomicNumber} />
          </motion.div>
        );
      } else {
        cells.push(
          <div
            key={`chem-${chemEl.atomicNumber}`}
            style={{ gridRow: row, gridColumn: col }}
            className={`${isDropping ? "ring-2 ring-white/50 rounded-md" : ""}`}
            onDragOver={(e) => handleDragOver(e as unknown as React.DragEvent, chemEl.atomicNumber)}
            onDragLeave={handleDragLeave}
            onDrop={() => handleDrop(chemEl.atomicNumber)}
          >
            <PlaceholderCard element={chemEl} />
          </div>
        );
      }
    }
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { duration: 0.5, staggerChildren: 0.01 },
    },
  };

  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollIndicators = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollIndicators();
    const observer = new ResizeObserver(updateScrollIndicators);
    observer.observe(el);
    return () => observer.disconnect();
  }, [updateScrollIndicators]);

  return (
    <div className="w-full pb-4 relative">
      {saveToast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg text-sm font-medium shadow-lg transition-opacity ${
            saveToast.type === "success"
              ? "bg-green-900/90 text-green-100 border border-green-700/50"
              : "bg-red-900/90 text-red-100 border border-red-700/50"
          }`}
        >
          {saveToast.message}
        </div>
      )}
      {canScrollLeft && (
        <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-black/60 to-transparent z-10 pointer-events-none md:hidden" />
      )}
      {canScrollRight && (
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-black/60 to-transparent z-10 pointer-events-none md:hidden" />
      )}
      <div
        ref={scrollRef}
        className="overflow-x-auto md:overflow-x-visible scrollbar-hide"
        onScroll={updateScrollIndicators}
      >
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="periodic-grid mx-auto"
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${GRID_COLS}, minmax(48px, 1fr))`,
            gridTemplateRows: `repeat(${GRID_ROWS}, auto)`,
            gap: "2px",
            maxWidth: "1100px",
            minWidth: `${GRID_COLS * 50}px`,
          }}
        >
          {cells}
        </motion.div>
      </div>
    </div>
  );
}
