"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Reorder } from "framer-motion";
import {
  blankAnswers,
  parseBlankText,
  seededShuffle,
  type BlankStep,
  type ChoiceStep,
  type MatchStep,
  type OrderStep,
} from "@/lib/course-lessons";

/**
 * SHAN-652. The interactive half of each exercise. The player owns the prompt,
 * the Check button and grading; these render the answer area and report what
 * the learner has picked. `status` is "idle" while answering and the graded
 * result once checked, at which point every control locks.
 */
export type ExerciseStatus = "idle" | "correct" | "wrong";

export const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);

/**
 * SHAN-659: every answer has a key, so a lesson runs without a mouse. Keys go
 * 1-9, then 0, then a-z, in reading order. An item keeps its key while
 * others are placed, so the key printed on a tile is always the one that
 * places it. In a match the right column carries on from the left: with five
 * pairs that is 1-5 and 6-0.
 */
export function keyLabel(i: number): string {
  if (i < 9) return String(i + 1);
  if (i === 9) return "0";
  return String.fromCharCode(97 + i - 10);
}

function keyIndex(key: string): number {
  if (/^[1-9]$/.test(key)) return Number(key) - 1;
  if (key === "0") return 9;
  if (/^[a-z]$/.test(key)) return 10 + key.charCodeAt(0) - 97;
  return -1;
}

/** An open notes card or the shortcut sheet owns the keyboard while it is up. */
export const keysBlocked = () => document.querySelector("[data-notes-popover], [data-keys-sheet]") !== null;

function useAnswerKeys(enabled: boolean, count: number, onPick: (i: number) => void, onBack?: () => void) {
  const ref = useRef({ onPick, onBack });
  ref.current = { onPick, onBack };
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target) || keysBlocked()) return;
      if (e.key === "Backspace") {
        if (!ref.current.onBack) return;
        e.preventDefault();
        ref.current.onBack();
        return;
      }
      const i = keyIndex(e.key);
      if (i < 0 || i >= count) return;
      e.preventDefault();
      ref.current.onPick(i);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, count]);
}

/** The key that picks an answer, printed on it. Pointer-only screens skip it. */
export function KeyBadge({ i, active, className = "" }: { i: number; active?: boolean; className?: string }) {
  return (
    <kbd
      aria-hidden="true"
      className={`hidden h-6 min-w-6 shrink-0 place-items-center rounded-md border px-1 font-mono text-[11px] leading-none [@media(pointer:fine)]:grid ${
        active ? "border-gray-200/60 text-white" : "border-white/15 text-gray-400"
      } ${className}`}
    >
      {keyLabel(i)}
    </kbd>
  );
}

// One shape for every tappable answer, so choices, tiles and pairs press the
// same way. Pressed = the learner's pick before checking.
function tone(opts: { pressed?: boolean; right?: boolean; wrong?: boolean; dim?: boolean }) {
  if (opts.right) return "border-teal-400/60 bg-teal-400/[0.12] text-white";
  if (opts.wrong) return "border-rose-400/60 bg-rose-400/[0.12] text-white";
  if (opts.pressed) return "border-gray-200/60 bg-white/[0.08] text-white";
  if (opts.dim) return "border-white/[0.06] bg-transparent text-gray-400";
  return "border-white/10 bg-white/[0.02] text-gray-100 hover:border-white/25 hover:bg-white/[0.05]";
}

const pressable =
  "border transition-[transform,background-color,border-color,color] duration-200 active:translate-y-px active:scale-[0.99] disabled:active:translate-y-0 disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50";

// ---- choice -----------------------------------------------------------------

export function ChoiceExercise({
  step,
  value,
  onChange,
  status,
}: {
  step: ChoiceStep;
  value: number[];
  onChange: (v: number[]) => void;
  status: ExerciseStatus;
}) {
  const multi = step.choices.filter((c) => c.correct).length > 1;
  const locked = status !== "idle";

  const toggle = (i: number) => {
    if (locked) return;
    if (!multi) onChange([i]);
    else onChange(value.includes(i) ? value.filter((v) => v !== i) : [...value, i].sort((a, b) => a - b));
  };

  // 1-8 picks a choice, the way the number badges promise. Backspace clears.
  useAnswerKeys(!locked, step.choices.length, toggle, () => onChange([]));

  return (
    <div>
      {multi && <p className="mb-3 text-sm text-gray-400">Select all that apply.</p>}
      <div role={multi ? "group" : "radiogroup"} aria-label="Answers" className="grid gap-2.5">
        {step.choices.map((c, i) => {
          const picked = value.includes(i);
          return (
            <button
              key={i}
              type="button"
              data-answer=""
              role={multi ? "checkbox" : "radio"}
              aria-checked={picked}
              aria-keyshortcuts={keyLabel(i)}
              disabled={locked}
              onClick={() => toggle(i)}
              className={`${pressable} flex min-h-14 w-full items-center gap-4 rounded-xl px-4 py-3 text-left text-[15px] leading-snug ${tone({
                pressed: picked && !locked,
                right: locked && !!c.correct,
                wrong: locked && picked && !c.correct,
                dim: locked && !picked && !c.correct,
              })}`}
            >
              <span
                aria-hidden="true"
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-md border font-mono text-xs ${
                  picked ? "border-gray-200/60 text-white" : "border-white/15 text-gray-400"
                }`}
              >
                {i + 1}
              </span>
              <span>{c.text}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---- fill in the blank ----------------------------------------------------

export function BlankExercise({
  step,
  value,
  onChange,
  status,
  seed,
  results,
}: {
  step: BlankStep;
  value: string[];
  onChange: (v: string[]) => void;
  status: ExerciseStatus;
  seed: string;
  /** Per-blank result once checked. */
  results: boolean[] | null;
}) {
  const parts = useMemo(() => parseBlankText(step.text), [step.text]);
  const answers = useMemo(() => blankAnswers(step), [step]);
  const locked = status !== "idle";

  // Word bank: each blank's first answer plus the distractors, shuffled once.
  // Tiles are tracked by index so two blanks with the same answer still work.
  const tiles = useMemo(
    () => (step.bank ? seededShuffle([...answers.map((a) => a[0]), ...step.bank], seed) : []),
    [answers, step.bank, seed],
  );
  // Seeded from `value`, because the player remounts a card on Back and Next
  // (SHAN-660) and the tiles must come back where they were (SHAN-661). Each
  // filled blank takes the first unused tile with its text.
  const [slotTile, setSlotTile] = useState<(number | null)[]>(() => {
    const used = new Set<number>();
    return answers.map((_, i) => {
      const t = value[i] ? tiles.findIndex((tile, j) => tile === value[i] && !used.has(j)) : -1;
      if (t < 0) return null;
      used.add(t);
      return t;
    });
  });
  const firstInput = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!step.bank) firstInput.current?.focus({ preventScroll: true });
  }, [step.bank]);

  const setSlots = (next: (number | null)[]) => {
    setSlotTile(next);
    onChange(next.map((t) => (t === null ? "" : tiles[t])));
  };
  const placeTile = (t: number) => {
    if (locked) return;
    const empty = slotTile.indexOf(null);
    if (empty === -1) return;
    const next = slotTile.slice();
    next[empty] = t;
    setSlots(next);
  };
  const clearSlot = (i: number) => {
    if (locked || slotTile[i] === null) return;
    const next = slotTile.slice();
    next[i] = null;
    setSlots(next);
  };

  // A tile's key places it; pressing it again once placed takes it back out.
  // Backspace empties the last filled blank.
  useAnswerKeys(
    !locked && !!step.bank,
    tiles.length,
    (t) => {
      const at = slotTile.indexOf(t);
      if (at >= 0) clearSlot(at);
      else placeTile(t);
    },
    () => {
      for (let i = slotTile.length - 1; i >= 0; i--) {
        if (slotTile[i] !== null) return clearSlot(i);
      }
    },
  );

  const slotTone = (i: number) =>
    results ? (results[i] ? "border-teal-400 text-teal-100" : "border-rose-400 text-rose-100") : "border-gray-400/60";

  return (
    <div className="space-y-8">
      <p className="text-xl leading-[2.4] text-gray-100 md:text-[22px]">
        {parts.map((p, k) => {
          if (p.kind === "text") return <span key={k}>{p.value}</span>;
          const i = p.index;
          const longest = Math.max(...(answers[i] ?? [""]).map((a) => a.length), 3);
          if (!step.bank) {
            return (
              <input
                key={k}
                ref={i === 0 ? firstInput : undefined}
                aria-label={`Blank ${i + 1}`}
                value={value[i] ?? ""}
                onChange={(e) => {
                  const next = answers.map((_, j) => value[j] ?? "");
                  next[i] = e.target.value;
                  onChange(next);
                }}
                readOnly={locked}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                style={{ width: `${Math.min(longest + 3, 28)}ch` }}
                className={`mx-1 rounded-none border-0 border-b-2 bg-transparent px-1 text-center font-medium text-white outline-none transition-colors focus:border-teal-300 ${slotTone(i)}`}
              />
            );
          }
          const t = slotTile[i];
          return (
            <button
              key={k}
              type="button"
              data-answer=""
              aria-label={t === null ? `Blank ${i + 1}, empty` : `Blank ${i + 1}: ${tiles[t]}. Tap to remove`}
              onClick={() => clearSlot(i)}
              disabled={locked}
              style={{ minWidth: `${Math.min(longest + 2, 24)}ch` }}
              className={`mx-1 inline-flex min-h-10 items-center justify-center rounded-lg border-b-2 px-2 align-middle leading-none ${
                t === null ? "bg-white/[0.03]" : "bg-white/[0.07] font-medium text-white"
              } ${slotTone(i)}`}
            >
              {t === null ? " " : tiles[t]}
            </button>
          );
        })}
      </p>

      {step.bank && (
        <div className="flex flex-wrap gap-2.5" aria-label="Word bank">
          {tiles.map((tile, t) => {
            const used = slotTile.includes(t);
            return (
              <button
                key={t}
                type="button"
              data-answer=""
                disabled={locked || used}
                onClick={() => placeTile(t)}
                aria-hidden={used}
                aria-keyshortcuts={used ? undefined : keyLabel(t)}
                tabIndex={used ? -1 : 0}
                className={`${pressable} inline-flex min-h-11 items-center gap-2.5 rounded-xl pl-4 pr-4 [@media(pointer:fine)]:pl-2.5 text-[15px] ${
                  used ? "border-dashed border-white/10 bg-transparent text-transparent" : tone({})
                }`}
              >
                <KeyBadge i={t} className={used ? "invisible" : ""} />
                {tile}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---- put in order -----------------------------------------------------------

/** Six dots: the "this moves" mark on a placed item. Plain spans, no icon set. */
function Grip() {
  return (
    <span aria-hidden="true" className="grid shrink-0 grid-cols-2 gap-[3px] opacity-60">
      {Array.from({ length: 6 }, (_, k) => (
        <span key={k} className="h-[3px] w-[3px] rounded-full bg-current" />
      ))}
    </span>
  );
}

export function OrderExercise({
  step,
  value,
  onChange,
  status,
  seed,
}: {
  step: OrderStep;
  value: string[];
  onChange: (v: string[]) => void;
  status: ExerciseStatus;
  seed: string;
}) {
  const pool = useMemo(() => seededShuffle(step.items, seed), [step.items, seed]);
  const locked = status !== "idle";
  const remaining = pool.filter((it) => !value.includes(it));

  // An item's key (its place in the shuffled pool) appends it, or takes it
  // back if it is already placed. Backspace takes back the last one.
  useAnswerKeys(
    !locked,
    pool.length,
    (i) => {
      const it = pool[i];
      onChange(value.includes(it) ? value.filter((v) => v !== it) : [...value, it]);
    },
    () => onChange(value.slice(0, -1)),
  );

  // SHAN-665: placed items can be dragged into a new order. A drag ends in a
  // click on the same button, which would take the item back out, so a click
  // right after a drag is swallowed. Alt+Up/Down does the same from the keys.
  const dragged = useRef(false);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const move = (from: number, to: number) => {
    if (to < 0 || to >= value.length) return;
    const it = value[from];
    const next = [...value];
    next.splice(to, 0, next.splice(from, 1)[0]);
    onChange(next);
    // Reordering moves DOM nodes, which can drop focus; keep it on the item.
    requestAnimationFrame(() => buttons.current.get(it)?.focus({ preventScroll: true }));
  };

  return (
    <div className="space-y-6">
      <Reorder.Group as="ol" axis="y" values={value} onReorder={onChange} aria-label="Your order" className="grid gap-2">
        {value.map((it, i) => {
          const right = locked && it === step.items[i];
          return (
            <Reorder.Item
              key={it}
              value={it}
              as="li"
              dragListener={!locked}
              onDragStart={() => {
                dragged.current = true;
              }}
              onDragEnd={() => {
                setTimeout(() => {
                  dragged.current = false;
                }, 0);
              }}
              whileDrag={{ scale: 1.02, zIndex: 10 }}
              className={`relative flex items-center gap-3 ${locked ? "" : "cursor-grab active:cursor-grabbing"}`}
            >
              <span aria-hidden="true" className="w-6 shrink-0 text-right font-mono text-xs tabular-nums text-gray-400">
                {i + 1}
              </span>
              <button
                ref={(el) => {
                  if (el) buttons.current.set(it, el);
                  else buttons.current.delete(it);
                }}
                type="button"
                data-answer=""
                disabled={locked}
                onClick={() => {
                  if (dragged.current) return;
                  onChange(value.filter((v) => v !== it));
                }}
                onKeyDown={(e) => {
                  if (!e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
                  e.preventDefault();
                  move(i, e.key === "ArrowUp" ? i - 1 : i + 1);
                }}
                aria-label={`${i + 1}. ${it}. Drag or Alt+arrow to move, tap to take it back`}
                aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
                className={`${pressable} flex min-h-11 flex-1 cursor-[inherit] select-none items-center gap-3 rounded-xl px-4 text-left text-[15px] ${tone({
                  pressed: !locked,
                  right,
                  wrong: locked && !right,
                })}`}
              >
                <span className="min-w-0 flex-1">{it}</span>
                {!locked && value.length > 1 && <Grip />}
              </button>
            </Reorder.Item>
          );
        })}
        {/* Only the next slot is drawn, so a long list never pushes the
            items to place below the fold. */}
        {!locked && remaining.length > 0 && (
          <li aria-hidden="true" className="flex items-center gap-3">
            <span className="w-6 shrink-0 text-right font-mono text-xs tabular-nums text-gray-400">{value.length + 1}</span>
            <span className="flex min-h-11 flex-1 items-center rounded-xl border border-dashed border-white/15 px-4 text-sm text-gray-400">
              {value.length === 0 ? "Tap the first one below" : "Tap the next one, or drag these to reorder"}
            </span>
          </li>
        )}
      </Reorder.Group>

      {!locked && remaining.length > 0 && (
        <div className="flex flex-wrap gap-2.5 pl-9" aria-label="Items to place">
          {remaining.map((it) => (
            <button
              key={it}
              type="button"
              data-answer=""
              aria-keyshortcuts={keyLabel(pool.indexOf(it))}
              onClick={() => onChange([...value, it])}
              className={`${pressable} inline-flex min-h-11 items-center gap-2.5 rounded-xl pl-4 pr-4 [@media(pointer:fine)]:pl-2.5 text-left text-[15px] ${tone({})}`}
            >
              <KeyBadge i={pool.indexOf(it)} />
              {it}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- match pairs ------------------------------------------------------------

export interface MatchValue {
  matched: number[];
  mistakes: number;
}

export function MatchExercise({
  step,
  value,
  onChange,
  status,
  seed,
}: {
  step: MatchStep;
  value: MatchValue;
  onChange: (v: MatchValue) => void;
  status: ExerciseStatus;
  seed: string;
}) {
  const lefts = useMemo(() => seededShuffle(step.pairs.map((_, i) => i), `${seed}:l`), [step.pairs, seed]);
  const rights = useMemo(() => seededShuffle(step.pairs.map((_, i) => i), `${seed}:r`), [step.pairs, seed]);
  const [sel, setSel] = useState<{ side: 0 | 1; pair: number } | null>(null);
  const [miss, setMiss] = useState<{ a: number; b: number } | null>(null);
  const missTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const locked = status !== "idle";

  useEffect(() => () => {
    if (missTimer.current) clearTimeout(missTimer.current);
  }, []);

  // A pick on each side resolves at once: a right pair locks in, a wrong one
  // flashes and counts as a mistake. Pairs are compared by index, never text.
  const pick = (side: 0 | 1, pair: number) => {
    if (locked || value.matched.includes(pair)) return;
    if (!sel || sel.side === side) {
      setSel(sel && sel.side === side && sel.pair === pair ? null : { side, pair });
      return;
    }
    setSel(null);
    if (sel.pair === pair) {
      onChange({ ...value, matched: [...value.matched, pair] });
      return;
    }
    const a = side === 0 ? pair : sel.pair;
    const b = side === 1 ? pair : sel.pair;
    setMiss({ a, b });
    if (missTimer.current) clearTimeout(missTimer.current);
    missTimer.current = setTimeout(() => setMiss(null), 650);
    onChange({ ...value, mistakes: value.mistakes + 1 });
  };

  // Keys run down the left column and carry on down the right one.
  const n = step.pairs.length;
  useAnswerKeys(
    !locked,
    n * 2,
    (i) => (i < n ? pick(0, lefts[i]) : pick(1, rights[i - n])),
    () => setSel(null),
  );

  const cell = (side: 0 | 1, pair: number, k: number) => {
    const done = value.matched.includes(pair);
    const selected = sel?.side === side && sel.pair === pair;
    const flashing = miss && (side === 0 ? miss.a === pair : miss.b === pair);
    return (
      <button
        key={`${side}-${pair}`}
        type="button"
        data-answer=""
        aria-pressed={selected}
        aria-keyshortcuts={done ? undefined : keyLabel(k)}
        disabled={locked || done}
        onClick={() => pick(side, pair)}
        className={`${pressable} flex min-h-14 w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-[15px] leading-snug [@media(pointer:fine)]:pl-3 ${
          done ? "border-teal-400/30 bg-teal-400/[0.06] text-teal-100/70" : tone({ pressed: selected, wrong: !!flashing })
        }`}
      >
        <KeyBadge i={k} active={selected} className={done ? "invisible" : ""} />
        <span className="min-w-0">{step.pairs[pair][side]}</span>
      </button>
    );
  };

  return (
    <div>
      <p className="mb-3 text-sm text-gray-400" aria-live="polite">
        {value.matched.length} of {step.pairs.length} matched
        {value.mistakes > 0 ? `, ${value.mistakes} miss${value.mistakes === 1 ? "" : "es"}` : ""}
      </p>
      <div className="grid grid-cols-2 gap-2.5 md:gap-4">
        <div className="grid content-start gap-2.5">{lefts.map((p, k) => cell(0, p, k))}</div>
        <div className="grid content-start gap-2.5">{rights.map((p, k) => cell(1, p, n + k))}</div>
      </div>
    </div>
  );
}
