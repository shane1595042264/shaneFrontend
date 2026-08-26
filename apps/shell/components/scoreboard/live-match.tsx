"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  finishMatch,
  scoreMatch,
  type Game,
  type Match,
  type MatchPlayer,
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
  const [picking, setPicking] = useState(false);
  const [celebrating, setCelebrating] = useState<MatchPlayer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isFinal = match.status === "final";

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

  async function finish(winner: MatchPlayer) {
    setError(null);
    try {
      await finishMatch(match.id, winner.playerId);
      setPicking(false);
      setCelebrating(winner);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not finish the match");
    }
  }

  const leader = [...match.players].sort(
    (a, b) => (scores[b.playerId] ?? 0) - (scores[a.playerId] ?? 0),
  )[0];

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
            {match.location ?? ""}
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
          const isWinner =
            celebrating?.playerId === p.playerId ||
            (isFinal && match.winnerPlayerId === p.playerId);
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
                  <CrownIcon className="h-5 w-5" /> Winner
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
              {isAdmin && !isFinal && !celebrating && (
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

      {isAdmin && !isFinal && !celebrating && (
        <div className="space-y-3">
          {!picking ? (
            <button
              onClick={() => setPicking(true)}
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-white px-4 text-sm font-medium text-black hover:bg-gray-200"
            >
              Finish match
            </button>
          ) : (
            <div className="space-y-2 rounded-lg border border-white/10 bg-black/20 p-4">
              <p className="text-sm text-gray-300">Who won?</p>
              <div className="flex flex-wrap gap-2">
                {match.players.map((p) => (
                  <button
                    key={p.playerId}
                    onClick={() => finish(p)}
                    className={`inline-flex min-h-11 items-center gap-2 rounded-md border px-4 text-sm ${
                      leader?.playerId === p.playerId
                        ? "border-white bg-white/10 font-medium"
                        : "border-white/20 hover:border-white/40"
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${colorStyles(p.color).solid}`}
                      aria-hidden="true"
                    />
                    {p.name}
                    {leader?.playerId === p.playerId && (
                      <span className="text-xs text-gray-400">(leading)</span>
                    )}
                  </button>
                ))}
                <button
                  onClick={() => setPicking(false)}
                  className="inline-flex min-h-11 items-center justify-center rounded-md bg-white/10 px-4 text-sm text-gray-200 hover:bg-white/15"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {(celebrating || isFinal) && (
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
