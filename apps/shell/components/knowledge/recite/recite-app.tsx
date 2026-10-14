"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Link from "@/components/transition-link";
import { ReciteSession, type ReciteOutcome } from "@/components/knowledge/recite/recite-session";
import { formatRelativeTime } from "@/lib/format-time";
import { listLocations } from "@/lib/api/practice";
import {
  fetchMemorizationLocations,
  fetchReciteDeck,
  type KnowledgeEntry,
  type ReciteDeck,
} from "@/lib/knowledge-api";

type Phase =
  | { kind: "where" }
  | { kind: "what"; deck: ReciteDeck }
  | { kind: "session"; deck: ReciteDeck; cards: KnowledgeEntry[] }
  | { kind: "done"; deck: ReciteDeck; outcomes: ReciteOutcome[] };

interface Place {
  name: string;
  lastUsedAt: string | null;
}

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

const fieldClass =
  "h-12 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 text-[15px] text-white placeholder:text-gray-400 transition-colors focus:border-white/25 focus:bg-white/[0.05] focus:outline-none";
const primaryClass =
  "inline-flex h-12 shrink-0 items-center justify-center rounded-full bg-white px-6 text-sm font-medium text-black transition-[transform,background-color] hover:bg-gray-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-gray-400";
const quietClass =
  "inline-flex h-10 items-center justify-center rounded-full px-4 text-sm text-gray-300 ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/[0.06] hover:text-white active:scale-[0.98]";

/**
 * SHAN-575: /knowledge/recite.
 *
 * Where are you, then what should come up, then the cards, then how it went.
 * The location is asked first because it decides the deck: a card is offered
 * only if it is not yet memorized at the place you are standing, which is the
 * SHAN-339 technique (seven distinct places makes a card long-term). Saying a
 * place the app has not seen creates it, server-side, in the same call that
 * fetches its deck.
 */
export function ReciteApp() {
  const reduce = useReducedMotion() ?? false;
  const [phase, setPhase] = useState<Phase>({ kind: "where" });
  const [loadingPlace, setLoadingPlace] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const openPlace = async (name: string) => {
    setLoadingPlace(name);
    setError(null);
    try {
      const deck = await fetchReciteDeck(name);
      setPhase({ kind: "what", deck });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load your cards");
    } finally {
      setLoadingPlace(null);
    }
  };

  const step = phase.kind;
  return (
    <div className="mx-auto max-w-3xl">
      {step !== "session" && (
        <Link
          href="/knowledge"
          className="inline-flex text-sm text-gray-400 transition-colors hover:text-white"
        >
          &larr; Knowledge
        </Link>
      )}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={step}
          initial={reduce ? false : { y: 14, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={reduce ? { opacity: 0 } : { y: -10, opacity: 0 }}
          transition={{ duration: 0.32, ease: EASE_OUT_EXPO }}
        >
          {phase.kind === "where" && (
            <WherePicker onPick={openPlace} loadingPlace={loadingPlace} error={error} />
          )}
          {phase.kind === "what" && (
            <WhatPicker
              deck={phase.deck}
              onChangePlace={() => setPhase({ kind: "where" })}
              onStart={(cards) => setPhase({ kind: "session", deck: phase.deck, cards })}
            />
          )}
          {phase.kind === "session" && (
            <ReciteSession
              location={phase.deck.location.name}
              cards={phase.cards}
              onDone={(outcomes) => setPhase({ kind: "done", deck: phase.deck, outcomes })}
            />
          )}
          {phase.kind === "done" && (
            <Summary
              location={phase.deck.location.name}
              outcomes={phase.outcomes}
              onAgain={() => openPlace(phase.deck.location.name)}
              onSkippedAgain={(cards) => setPhase({ kind: "session", deck: phase.deck, cards })}
              onChangePlace={() => setPhase({ kind: "where" })}
              allCards={phase.deck.cards}
              busy={loadingPlace !== null}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function WherePicker({
  onPick,
  loadingPlace,
  error,
}: {
  onPick: (name: string) => void;
  loadingPlace: string | null;
  error: string | null;
}) {
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    let cancelled = false;
    // Two lists, merged: the places you have practiced or recited at (most
    // recent first), then any place a card was marked at by hand that never
    // went through practice. Either failing just shortens the list.
    Promise.allSettled([listLocations(), fetchMemorizationLocations()]).then(([saved, onCards]) => {
      if (cancelled) return;
      const merged: Place[] = [];
      const seen = new Set<string>();
      const add = (name: string, lastUsedAt: string | null) => {
        const key = name.trim().toLowerCase().replace(/\s+/g, " ");
        if (!key || seen.has(key)) return;
        seen.add(key);
        merged.push({ name: name.trim(), lastUsedAt });
      };
      if (saved.status === "fulfilled") for (const l of saved.value) add(l.name, l.lastUsedAt);
      if (onCards.status === "fulfilled") for (const n of onCards.value) add(n, null);
      setPlaces(merged);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const name = draft.trim();
    if (name && !loadingPlace) onPick(name);
  };

  return (
    <section className="pt-8 md:pt-12">
      <h2 className="text-3xl font-semibold tracking-[-0.03em] text-white md:text-[44px] md:leading-[1.05]">
        Where are you?
      </h2>
      <p className="mt-3 max-w-[60ch] text-[15px] leading-relaxed text-gray-400">
        Recite only brings up cards you haven&apos;t memorized at this place yet.
      </p>

      {places === null ? (
        <div className="mt-10 grid gap-2 sm:grid-cols-2" aria-hidden="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[68px] animate-pulse rounded-xl bg-white/[0.04]" />
          ))}
        </div>
      ) : places.length > 0 ? (
        <ul className="mt-10 grid gap-2 sm:grid-cols-2">
          {places.map((p) => {
            const busy = loadingPlace === p.name;
            return (
              <li key={p.name}>
                <button
                  type="button"
                  onClick={() => onPick(p.name)}
                  disabled={loadingPlace !== null}
                  className="spot group flex w-full items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 py-3.5 text-left transition-[border-color,background-color,transform] hover:border-white/15 hover:bg-white/[0.045] active:scale-[0.99] disabled:cursor-wait"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-medium text-white">{p.name}</span>
                    <span className="mt-0.5 block font-mono text-[11px] text-gray-400">
                      {busy
                        ? "Loading your cards..."
                        : p.lastUsedAt
                          ? `Last here ${formatRelativeTime(p.lastUsedAt)}`
                          : "Marked on your cards"}
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className="text-gray-400 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-white"
                  >
                    &rarr;
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      <form onSubmit={submit} className="mt-6 flex flex-col gap-2 sm:flex-row">
        <label htmlFor="recite-new-place" className="sr-only">
          Somewhere new
        </label>
        <input
          id="recite-new-place"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={120}
          autoComplete="off"
          placeholder={places?.length ? "Somewhere new" : "Name the place you're in"}
          className={fieldClass}
        />
        <button type="submit" disabled={!draft.trim() || loadingPlace !== null} className={primaryClass}>
          {loadingPlace && loadingPlace === draft.trim() ? "Loading..." : "Recite here"}
        </button>
      </form>
      <p className="mt-2 text-xs text-gray-400">A new place is saved for next time.</p>

      {error && (
        <p role="alert" className="mt-4 text-sm text-red-300">
          {error}
        </p>
      )}
    </section>
  );
}

function WhatPicker({
  deck,
  onChangePlace,
  onStart,
}: {
  deck: ReciteDeck;
  onChangePlace: () => void;
  onStart: (cards: KnowledgeEntry[]) => void;
}) {
  // Empty means everything, which is what most sittings want.
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const categories = useMemo(
    () => [...deck.categories].sort((a, b) => b.remaining - a.remaining || a.category.localeCompare(b.category)),
    [deck.categories]
  );
  const remaining = deck.categories.reduce((n, c) => n + c.remaining, 0);
  const total = deck.categories.reduce((n, c) => n + c.total, 0);
  const cards = picked.size === 0 ? deck.cards : deck.cards.filter((c) => picked.has(c.category));

  const toggle = (category: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });

  const chip = (active: boolean) =>
    `inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm capitalize transition-[background-color,color,transform] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${
      active
        ? "bg-white/[0.08] text-white ring-1 ring-inset ring-white/15"
        : "text-gray-400 ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.04] hover:text-white"
    }`;

  return (
    <section className="pt-8 md:pt-12">
      <button
        type="button"
        onClick={onChangePlace}
        className="group inline-flex items-center gap-2 rounded-full bg-teal-400/[0.08] py-1 pl-2.5 pr-3 text-sm text-teal-200 ring-1 ring-inset ring-teal-300/20 transition-colors hover:bg-teal-400/[0.14]"
      >
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-teal-300" />
        At {deck.location.name}
        <span className="text-teal-200/70 group-hover:text-teal-100">Change</span>
      </button>

      {remaining === 0 ? (
        <div className="mt-8">
          <h2 className="text-3xl font-semibold tracking-[-0.03em] text-white md:text-[44px] md:leading-[1.05]">
            {total === 0 ? "No cards to recite yet." : `All ${total} memorized here.`}
          </h2>
          <p className="mt-3 max-w-[46ch] text-[15px] leading-relaxed text-gray-400">
            {total === 0
              ? "Add a card with a definition on the Knowledge page, then come back."
              : "Every card you own is memorized at this place. Recite somewhere else to keep building."}
          </p>
          <div className="mt-8 flex flex-wrap gap-2">
            <button type="button" onClick={onChangePlace} className={primaryClass}>
              Pick another place
            </button>
          </div>
        </div>
      ) : (
        <>
          <h2 className="mt-8 text-3xl font-semibold tracking-[-0.03em] text-white md:text-[44px] md:leading-[1.05]">
            What should come up?
          </h2>
          <p className="mt-3 max-w-[62ch] text-[15px] leading-relaxed text-gray-400">
            <span className="text-white tabular-nums">{remaining}</span> of {total} cards aren&apos;t
            memorized here yet. Pick categories, or take everything.
          </p>

          <div className="mt-8 flex flex-wrap gap-2" role="group" aria-label="Categories">
            <button
              type="button"
              aria-pressed={picked.size === 0}
              onClick={() => setPicked(new Set())}
              className={chip(picked.size === 0)}
            >
              Everything
              <span className="font-mono text-xs tabular-nums text-gray-400">{remaining}</span>
            </button>
            {categories.map((c) => (
              <button
                key={c.category}
                type="button"
                aria-pressed={picked.has(c.category)}
                disabled={c.remaining === 0}
                onClick={() => toggle(c.category)}
                className={chip(picked.has(c.category))}
              >
                {c.category}
                <span className="font-mono text-xs normal-case tabular-nums text-gray-400">
                  {c.remaining === 0 ? "done" : c.remaining}
                </span>
              </button>
            ))}
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => onStart(cards)}
              disabled={cards.length === 0}
              className={primaryClass}
            >
              Start reciting
            </button>
            <p className="text-sm text-gray-400">
              <span className="tabular-nums text-white">{cards.length}</span> card{cards.length === 1 ? "" : "s"},
              shuffled
            </p>
          </div>
        </>
      )}
    </section>
  );
}

function Summary({
  location,
  outcomes,
  allCards,
  onAgain,
  onSkippedAgain,
  onChangePlace,
  busy,
}: {
  location: string;
  outcomes: ReciteOutcome[];
  allCards: KnowledgeEntry[];
  onAgain: () => void;
  onSkippedAgain: (cards: KnowledgeEntry[]) => void;
  onChangePlace: () => void;
  busy: boolean;
}) {
  const memorized = outcomes.filter((o) => o.status === "memorized");
  const skippedIds = new Set(outcomes.filter((o) => o.status === "skipped").map((o) => o.id));
  const deleted = outcomes.filter((o) => o.status === "deleted").length;
  const skippedCards = allCards.filter((c) => skippedIds.has(c.id));

  return (
    <section className="pt-8 md:pt-12">
      <p className="font-mono text-xs text-gray-400">At {location}</p>
      <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-white md:text-[44px] md:leading-[1.05]">
        {memorized.length > 0
          ? `${memorized.length} memorized here.`
          : "Nothing new memorized this time."}
      </h2>
      <p className="mt-3 text-[15px] text-gray-400">
        {[
          `${outcomes.length} card${outcomes.length === 1 ? "" : "s"} seen`,
          skippedCards.length > 0 ? `${skippedCards.length} skipped` : null,
          deleted > 0 ? `${deleted} deleted` : null,
        ]
          .filter(Boolean)
          .join(", ")}
        .
      </p>

      {memorized.length > 0 && (
        <ul className="mt-8 flex flex-wrap gap-2">
          {memorized.map((o) => (
            <li
              key={o.id}
              className="rounded-full bg-teal-400/[0.08] px-3.5 py-1.5 text-sm text-teal-100 ring-1 ring-inset ring-teal-300/20"
            >
              {o.word}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-10 flex flex-wrap items-center gap-2">
        {skippedCards.length > 0 && (
          <button type="button" onClick={() => onSkippedAgain(skippedCards)} className={primaryClass}>
            Go again with {skippedCards.length} skipped
          </button>
        )}
        <button
          type="button"
          onClick={onAgain}
          disabled={busy}
          className={skippedCards.length > 0 ? quietClass : primaryClass}
        >
          {busy ? "Loading..." : "New deck here"}
        </button>
        <button type="button" onClick={onChangePlace} className={quietClass}>
          Change place
        </button>
      </div>
    </section>
  );
}
