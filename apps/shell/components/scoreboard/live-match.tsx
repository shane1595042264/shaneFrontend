"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  finishMatch,
  scoreMatch,
  updateMatch,
  type Game,
  type Match,
} from "@/lib/api/scoreboard";
import { GameIcon, CrownIcon } from "./game-icon";
import { colorStyles } from "./palette";

export function LiveMatch({
  match,
  game,
  isAdmin,
  refresh,
  onExit,
}: {
  match: Match;
  game: Game | null;
  isAdmin: boolean;
  refresh: () => Promise<void>;
  onExit: () => void;
}) {
  // Local optimistic scores keyed by playerId; server refresh reconciles.
  const [scores, setScores] = useState<Record<string, number>>(() =>
    Object.fromEntries(match.players.map((p) => [p.playerId, p.score])),
  );
  // Inline address edit for the match in play (SHAN-436).
  const [editingLocation, setEditingLocation] = useState(false);
  const [draftLocation, setDraftLocation] = useState(match.location ?? "");
  // The just-finished match, held so the crown lands before the parent's
  // refresh round-trip replaces the `match` prop with the final one.
  const [celebrating, setCelebrating] = useState<Match | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const settled = celebrating ?? (match.status === "final" ? match : null);
  const winnerIds = new Set(settled?.winnerPlayerIds ?? []);

  async function tap(playerId: string, delta: 1 | -1) {
    const prev = scores[playerId] ?? 0;
    const next = Math.max(prev + delta, 0);
    setScores((s) => ({ ...s, [playerId]: next }));
    try {
      await scoreMatch(match.id, playerId, delta);
      setError(null);
    } catch (err) {
      setScores((s) => ({ ...s, [playerId]: prev }));
      setError(err instanceof Error ? err.message : "Score did not save");
    }
  }

  async function saveLocation(e: React.FormEvent) {
    e.preventDefault();
    const next = draftLocation.trim();
    // An unchanged address would be an empty patch, which the API rejects.
    if (next === (match.location ?? "")) {
      setEditingLocation(false);
      return;
    }
    setError(null);
    try {
      await updateMatch(match.id, { location: next || null });
      setEditingLocation(false);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the address");
    }
  }

  // No winner is passed: the API decides it from the scores, and a shared
  // top score comes back as a tie (SHAN-446).
  async function finish() {
    setError(null);
    setFinishing(true);
    try {
      setCelebrating(await finishMatch(match.id));
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not finish the match");
    } finally {
      setFinishing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={onExit}
          className="text-sm text-gray-500 hover:text-gray-300"
        >
          &larr; {game ? game.name : "Back"}
        </button>
        {game && (
          <span
            className={`flex items-center gap-2 text-sm ${colorStyles(game.color).text}`}
          >
            <GameIcon icon={game.icon} className="h-5 w-5" />
            {isAdmin && editingLocation ? (
              <form onSubmit={saveLocation} className="flex items-center gap-2">
                <input
                  value={draftLocation}
                  onChange={(e) => setDraftLocation(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setEditingLocation(false);
                  }}
                  autoFocus
                  maxLength={160}
                  placeholder="Essential Square, Frisco"
                  aria-label="Match address"
                  className="w-48 rounded-md border border-white/20 bg-black/30 px-2 py-1 text-sm text-white placeholder-gray-500 focus:border-white/40 focus:outline-none"
                />
                <button
                  type="submit"
                  className="text-xs text-gray-300 underline hover:text-white"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setEditingLocation(false)}
                  className="text-xs text-gray-500 underline hover:text-gray-300"
                >
                  Cancel
                </button>
              </form>
            ) : isAdmin ? (
              <button
                onClick={() => {
                  setDraftLocation(match.location ?? "");
                  setEditingLocation(true);
                }}
                className="underline decoration-dotted underline-offset-2 hover:text-white"
              >
                {match.location ?? "Add address"}
              </button>
            ) : (
              (match.location ?? "")
            )}
          </span>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:auto-cols-fr lg:grid-flow-col">
        {match.players.map((p, i) => {
          const pStyles = colorStyles(p.color);
          const isWinner = winnerIds.has(p.playerId);
          return (
            <motion.section
              key={p.playerId}
              animate={
                isWinner
                  ? { scale: [1, 1.06, 1], rotate: [0, 2, -2, 0] }
                  : { scale: 1, rotate: 0 }
              }
              transition={isWinner ? { duration: 0.7, type: "tween" } : undefined}
              className={`relative flex flex-col items-center gap-4 rounded-lg border ${pStyles.border} ${pStyles.bg} p-6 ${
                isWinner ? `ring-2 ${pStyles.ring}` : ""
              }`}
              aria-label={`${p.name} score panel`}
            >
              {i > 0 && (
                <span
                  className="absolute -left-3 top-1/2 hidden -translate-y-1/2 text-xs font-bold tracking-widest text-gray-500 lg:block"
                  aria-hidden="true"
                >
                  VS
                </span>
              )}
              {isWinner && (
                <motion.span
                  initial={{ scale: 0, rotate: -20 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 15 }}
                  className="flex items-center gap-1 text-xs font-bold tracking-widest text-yellow-300 uppercase"
                >
                  <CrownIcon className="h-5 w-5" />{" "}
                  {settled?.outcome === "tie" ? "Draw" : "Winner"}
                </motion.span>
              )}
              <h2
                className={`text-lg font-bold tracking-widest uppercase ${pStyles.text}`}
              >
                {p.name}
              </h2>
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.p
                  key={scores[p.playerId] ?? 0}
                  initial={{ scale: 1.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.7, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 18 }}
                  className="text-8xl font-bold tabular-nums"
                >
                  {scores[p.playerId] ?? 0}
                </motion.p>
              </AnimatePresence>
              {isAdmin && !settled && (
                <div className="flex gap-3">
                  <button
                    onClick={() => tap(p.playerId, -1)}
                    aria-label={`Minus one for ${p.name}`}
                    className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md bg-white/10 text-xl text-gray-200 hover:bg-white/15"
                  >
                    -1
                  </button>
                  <button
                    onClick={() => tap(p.playerId, 1)}
                    aria-label={`Plus one for ${p.name}`}
                    className="inline-flex min-h-11 min-w-14 items-center justify-center rounded-md bg-white text-xl font-medium text-black hover:bg-gray-200"
                  >
                    +1
                  </button>
                </div>
              )}
            </motion.section>
          );
        })}
      </div>

      {isAdmin && !settled && (
        <button
          onClick={finish}
          disabled={finishing}
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-white px-4 text-sm font-medium text-black hover:bg-gray-200 disabled:opacity-60"
        >
          {finishing ? "Finishing..." : "Finish match"}
        </button>
      )}

      {settled?.outcome === "tie" && (
        <p className="rounded-lg border border-white/10 bg-black/20 p-4 text-sm tracking-widest text-gray-300 uppercase">
          Dead heat. Nobody takes this one.
        </p>
      )}

      {settled && (
        <button
          onClick={onExit}
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-white px-4 text-sm font-medium text-black hover:bg-gray-200"
        >
          Back to the cabinet
        </button>
      )}
    </div>
  );
}
