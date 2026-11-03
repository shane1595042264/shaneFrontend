"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);

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

  // 1-9 picks a choice, the way the number badges promise.
  const toggleRef = useRef(toggle);
  toggleRef.current = toggle;
  useEffect(() => {
    if (locked) return;
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      const n = Number(e.key);
      if (Number.isInteger(n) && n >= 1 && n <= step.choices.length) {
        e.preventDefault();
        toggleRef.current(n - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [locked, step.choices.length]);

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
  const [slotTile, setSlotTile] = useState<(number | null)[]>(() => answers.map(() => null));
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
                tabIndex={used ? -1 : 0}
                className={`${pressable} min-h-11 rounded-xl px-4 text-[15px] ${
                  used ? "border-dashed border-white/10 bg-transparent text-transparent" : tone({})
                }`}
              >
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

  return (
    <div className="space-y-6">
      <ol aria-label="Your order" className="grid gap-2">
        {value.map((it, i) => {
          const right = locked && it === step.items[i];
          return (
            <li key={it} className="flex items-center gap-3">
              <span aria-hidden="true" className="w-6 shrink-0 text-right font-mono text-xs tabular-nums text-gray-400">
                {i + 1}
              </span>
              <button
                type="button"
                data-answer=""
                disabled={locked}
                onClick={() => onChange(value.filter((v) => v !== it))}
                aria-label={`${i + 1}. ${it}. Tap to take it back`}
                className={`${pressable} flex min-h-11 flex-1 items-center rounded-xl px-4 text-left text-[15px] ${tone({
                  pressed: !locked,
                  right,
                  wrong: locked && !right,
                })}`}
              >
                {it}
              </button>
            </li>
          );
        })}
        {/* Only the next slot is drawn, so a long list never pushes the
            items to place below the fold. */}
        {!locked && remaining.length > 0 && (
          <li aria-hidden="true" className="flex items-center gap-3">
            <span className="w-6 shrink-0 text-right font-mono text-xs tabular-nums text-gray-400">{value.length + 1}</span>
            <span className="flex min-h-11 flex-1 items-center rounded-xl border border-dashed border-white/15 px-4 text-sm text-gray-400">
              {value.length === 0 ? "Tap the first one below" : "Tap the next one"}
            </span>
          </li>
        )}
      </ol>

      {!locked && remaining.length > 0 && (
        <div className="flex flex-wrap gap-2.5 pl-9" aria-label="Items to place">
          {remaining.map((it) => (
            <button
              key={it}
              type="button"
              data-answer=""
              onClick={() => onChange([...value, it])}
              className={`${pressable} min-h-11 rounded-xl px-4 text-left text-[15px] ${tone({})}`}
            >
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

  const cell = (side: 0 | 1, pair: number) => {
    const done = value.matched.includes(pair);
    const selected = sel?.side === side && sel.pair === pair;
    const flashing = miss && (side === 0 ? miss.a === pair : miss.b === pair);
    return (
      <button
        key={`${side}-${pair}`}
        type="button"
              data-answer=""
        aria-pressed={selected}
        disabled={locked || done}
        onClick={() => pick(side, pair)}
        className={`${pressable} min-h-14 w-full rounded-xl px-4 py-3 text-left text-[15px] leading-snug ${
          done ? "border-teal-400/30 bg-teal-400/[0.06] text-teal-100/70" : tone({ pressed: selected, wrong: !!flashing })
        }`}
      >
        {step.pairs[pair][side]}
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
        <div className="grid content-start gap-2.5">{lefts.map((p) => cell(0, p))}</div>
        <div className="grid content-start gap-2.5">{rights.map((p) => cell(1, p))}</div>
      </div>
    </div>
  );
}
