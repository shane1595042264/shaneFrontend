"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { Game, GameStat, Match, Player } from "@/lib/api/scoreboard";
import { GameIcon } from "./game-icon";
import { colorStyles } from "./palette";
import { AddGameForm } from "./add-game-form";
import { AddPlayerForm } from "./add-player-form";

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.9 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring" as const, stiffness: 260, damping: 20 },
  },
};

export function Hall({
  games,
  stats,
  players,
  matches,
  isAdmin,
  refresh,
  onSelectGame,
  onOpenMatch,
}: {
  games: Game[];
  stats: GameStat[];
  players: Player[];
  matches: Match[];
  isAdmin: boolean;
  refresh: () => Promise<void>;
  onSelectGame: (id: string) => void;
  onOpenMatch: (id: string) => void;
}) {
  const [showAddGame, setShowAddGame] = useState(false);
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const liveMatches = matches.filter((m) => m.status === "live");

  // All-time match-win tally line for one game's cabinet card.
  function tallyLine(gameId: string): string | null {
    const rows = stats.filter((s) => s.gameId === gameId && s.playerId);
    if (rows.length === 0) return null;
    const named = rows
      .map((s) => ({
        name: players.find((p) => p.id === s.playerId)?.name ?? "?",
        wins: s.wins,
      }))
      .sort((a, b) => b.wins - a.wins);
    return named.map((n) => `${n.name} ${n.wins}`).join(" - ");
  }

  return (
    <div className="space-y-8">
      {liveMatches.map((m) => {
        const game = games.find((g) => g.id === m.gameId);
        const styles = colorStyles(game?.color ?? "emerald");
        return (
          <button
            key={m.id}
            onClick={() => onOpenMatch(m.id)}
            className={`flex w-full items-center justify-between rounded-lg border ${styles.border} ${styles.bg} p-4 text-left hover:shadow-lg hover:shadow-black/40`}
          >
            <span className="flex items-center gap-3">
              <span
                className={`relative flex h-2.5 w-2.5 ${styles.text}`}
                aria-hidden="true"
              >
                <span
                  className={`absolute inline-flex h-full w-full animate-ping rounded-full ${styles.solid} opacity-75`}
                />
                <span
                  className={`relative inline-flex h-2.5 w-2.5 rounded-full ${styles.solid}`}
                />
              </span>
              <span className="text-sm font-medium tracking-widest uppercase">
                Now playing
              </span>
              <span className="text-sm text-gray-300">{game?.name}</span>
            </span>
            <span className="text-sm tabular-nums text-gray-300">
              {m.players.map((p) => p.score).join(" : ")}
            </span>
          </button>
        );
      })}

      {games.length === 0 && (
        <p className="rounded-lg border border-white/10 bg-black/20 p-8 text-center text-sm italic text-gray-500">
          The hall is empty.{" "}
          {isAdmin
            ? "Add the first game below."
            : "Games appear here once recorded."}
        </p>
      )}

      <motion.div
        initial="hidden"
        animate="visible"
        variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
        className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
      >
        {games.map((game) => {
          const styles = colorStyles(game.color);
          const tally = tallyLine(game.id);
          return (
            <motion.button
              key={game.id}
              variants={cardVariants}
              whileHover={{ scale: 1.05, y: -3 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => onSelectGame(game.id)}
              className={`flex flex-col items-center gap-3 rounded-lg border ${styles.border} ${styles.bg} p-5 pt-6 text-center hover:shadow-lg hover:shadow-black/40 focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:outline-none`}
              aria-label={`Open ${game.name} cabinet`}
            >
              <span className={styles.text}>
                <GameIcon icon={game.icon} className="h-16 w-16" />
              </span>
              <span className="text-sm font-bold tracking-widest uppercase">
                {game.name}
              </span>
              <span className="min-h-4 text-xs tabular-nums text-gray-400">
                {tally ?? "No matches yet"}
              </span>
            </motion.button>
          );
        })}
      </motion.div>

      {isAdmin && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => {
                setShowAddGame((v) => !v);
                setShowAddPlayer(false);
              }}
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-white px-4 text-sm font-medium text-black hover:bg-gray-200"
            >
              {showAddGame ? "Close" : "+ New game"}
            </button>
            <button
              onClick={() => {
                setShowAddPlayer((v) => !v);
                setShowAddGame(false);
              }}
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-white/10 px-4 text-sm text-gray-200 hover:bg-white/15"
            >
              {showAddPlayer ? "Close" : "+ Player"}
            </button>
          </div>
          {showAddGame && (
            <AddGameForm
              onCreated={async () => {
                setShowAddGame(false);
                await refresh();
              }}
            />
          )}
          {showAddPlayer && (
            <AddPlayerForm
              players={players}
              refresh={refresh}
              onCreated={refresh}
            />
          )}
        </div>
      )}
    </div>
  );
}
