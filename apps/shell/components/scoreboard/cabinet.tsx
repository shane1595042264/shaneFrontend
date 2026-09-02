"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  createMatch,
  deleteGame,
  deleteMatch,
  reopenMatch,
  updateMatch,
  type Game,
  type Match,
  type Player,
} from "@/lib/api/scoreboard";
import { GameIcon, CrownIcon } from "./game-icon";
import { GameForm } from "./game-form";
import { colorStyles } from "./palette";

export function Cabinet({
  game,
  players,
  matches,
  isAdmin,
  refresh,
  onBack,
  onOpenMatch,
}: {
  game: Game;
  players: Player[];
  matches: Match[];
  isAdmin: boolean;
  refresh: () => Promise<void>;
  onBack: () => void;
  onOpenMatch: (id: string) => void;
}) {
  const styles = colorStyles(game.color);
  const [showStart, setShowStart] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showRules, setShowRules] = useState(false);
  // Which match's address is being edited inline, and the draft (SHAN-436).
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [draftLocation, setDraftLocation] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [location, setLocation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const finals = matches.filter((m) => m.status === "final");
  const liveHere = matches.filter((m) => m.status === "live");

  function togglePick(id: string) {
    setPicked((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  }

  async function start(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const match = await createMatch({
        gameId: game.id,
        playerIds: picked,
        location: location.trim() || null,
      });
      await refresh();
      onOpenMatch(match.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the match");
      setBusy(false);
    }
  }

  async function removeGame() {
    if (!window.confirm(`Delete ${game.name} and all its matches?`)) return;
    setError(null);
    try {
      await deleteGame(game.id);
      await refresh();
      onBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete the game");
    }
  }

  async function reopen(id: string) {
    setError(null);
    try {
      await reopenMatch(id);
      await refresh();
      onOpenMatch(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reopen the match");
    }
  }

  function startLocationEdit(match: Match) {
    setError(null);
    setEditingLocationId(match.id);
    setDraftLocation(match.location ?? "");
  }

  async function saveLocation(e: React.FormEvent, match: Match) {
    e.preventDefault();
    const next = draftLocation.trim();
    // An unchanged address would be an empty patch, which the API rejects.
    if (next === (match.location ?? "")) {
      setEditingLocationId(null);
      return;
    }
    setError(null);
    try {
      await updateMatch(match.id, { location: next || null });
      setEditingLocationId(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the address");
    }
  }

  async function removeMatch(id: string) {
    if (!window.confirm("Delete this match record?")) return;
    setError(null);
    try {
      await deleteMatch(id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete the match");
    }
  }

  return (
    <div className="space-y-8">
      <button
        onClick={onBack}
        className="text-sm text-gray-500 hover:text-gray-300"
      >
        &larr; Back to the hall
      </button>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className={`flex flex-wrap items-center gap-6 rounded-lg border ${styles.border} ${styles.bg} p-6`}
      >
        <span className={styles.text}>
          <GameIcon icon={game.icon} className="h-20 w-20" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-bold tracking-widest uppercase">
            {game.name}
          </h2>
          {game.description && (
            <p className="mt-1 text-sm text-gray-300">{game.description}</p>
          )}
          {game.rules && (
            <button
              onClick={() => setShowRules((v) => !v)}
              className="mt-2 text-xs text-gray-400 underline hover:text-gray-200"
              aria-expanded={showRules}
            >
              {showRules ? "Hide house rules" : "House rules"}
            </button>
          )}
          {showRules && game.rules && (
            <p className="mt-2 text-sm whitespace-pre-wrap text-gray-300">
              {game.rules}
            </p>
          )}
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <button
              onClick={() => {
                setShowStart((v) => !v);
                setShowEdit(false);
              }}
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-white px-4 text-sm font-medium text-black hover:bg-gray-200"
            >
              {showStart ? "Close" : "Start match"}
            </button>
            <button
              onClick={() => {
                setShowEdit((v) => !v);
                setShowStart(false);
              }}
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-white/10 px-3 text-sm text-gray-200 hover:bg-white/15"
            >
              {showEdit ? "Close" : "Edit"}
            </button>
            <button
              onClick={removeGame}
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-white/10 px-3 text-sm text-red-300 hover:bg-white/15"
            >
              Delete
            </button>
          </div>
        )}
      </motion.section>

      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}

      {isAdmin && showEdit && (
        <GameForm
          game={game}
          onSaved={async () => {
            setShowEdit(false);
            await refresh();
          }}
          onCancel={() => setShowEdit(false)}
        />
      )}

      {isAdmin && showStart && (
        <form
          onSubmit={start}
          className="space-y-4 rounded-lg border border-white/10 bg-black/20 p-4"
        >
          <h3 className="text-lg font-medium">Who is playing?</h3>
          <div className="flex flex-wrap gap-2">
            {players.map((p) => {
              const pStyles = colorStyles(p.color);
              const on = picked.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => togglePick(p.id)}
                  className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${
                    on
                      ? `${pStyles.border} ${pStyles.bg}`
                      : "border-white/10 hover:border-white/30"
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${pStyles.solid}`}
                    aria-hidden="true"
                  />
                  {p.name}
                </button>
              );
            })}
            {players.length === 0 && (
              <p className="text-sm italic text-gray-500">
                Add players in the hall first.
              </p>
            )}
          </div>
          <label className="block text-sm text-gray-300">
            Location
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              maxLength={160}
              placeholder="Essential Square, Frisco"
              className="mt-1 w-full max-w-md rounded-md border border-white/20 bg-black/30 px-2 py-1.5 text-sm text-white placeholder-gray-500 focus:border-white/40 focus:outline-none"
            />
          </label>
          <button
            type="submit"
            disabled={busy || picked.length < 2}
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-white px-4 text-sm font-medium text-black hover:bg-gray-200 disabled:opacity-50"
          >
            {busy ? "Starting..." : `Insert coin (${picked.length} players)`}
          </button>
        </form>
      )}

      {liveHere.length > 0 && (
        <section className="space-y-2">
          {liveHere.map((m) => (
            <button
              key={m.id}
              onClick={() => onOpenMatch(m.id)}
              className={`flex w-full items-center justify-between rounded-lg border ${styles.border} ${styles.bg} p-4 text-left hover:shadow-lg hover:shadow-black/40`}
            >
              <span className="text-sm font-medium tracking-widest uppercase">
                Live: {m.players.map((p) => p.name).join(" vs ")}
              </span>
              <span className="text-lg font-bold tabular-nums">
                {m.players.map((p) => p.score).join(" : ")}
              </span>
            </button>
          ))}
        </section>
      )}

      <section>
        <h3 className="mb-3 text-lg font-medium tracking-widest uppercase">
          Record wall
        </h3>
        {finals.length === 0 ? (
          <p className="rounded-lg border border-white/10 bg-black/20 p-6 text-center text-sm italic text-gray-500">
            No finished matches yet.
          </p>
        ) : (
          <ul className="divide-y divide-white/8 rounded-lg border border-white/10 bg-black/20">
            {finals.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-3 p-4"
              >
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    {m.players.map((p) => {
                      const pStyles = colorStyles(p.color);
                      const isWinner = p.playerId === m.winnerPlayerId;
                      return (
                        <span
                          key={p.playerId}
                          className={`flex items-center gap-1.5 ${pStyles.text}`}
                        >
                          {isWinner && (
                            <CrownIcon className="h-4 w-4 text-yellow-300" />
                          )}
                          <span className={isWinner ? "font-bold" : ""}>
                            {p.name}
                          </span>
                          <span className="text-lg font-bold tabular-nums">
                            {p.score}
                          </span>
                        </span>
                      );
                    })}
                  </p>
                  {editingLocationId === m.id ? (
                    <form
                      onSubmit={(e) => saveLocation(e, m)}
                      className="mt-1 flex flex-wrap items-center gap-2"
                    >
                      <input
                        value={draftLocation}
                        onChange={(e) => setDraftLocation(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") setEditingLocationId(null);
                        }}
                        autoFocus
                        maxLength={160}
                        placeholder="Essential Square, Frisco"
                        aria-label="Match address"
                        className="w-full max-w-xs rounded-md border border-white/20 bg-black/30 px-2 py-1 text-xs text-white placeholder-gray-500 focus:border-white/40 focus:outline-none"
                      />
                      <button
                        type="submit"
                        className="text-xs text-gray-300 underline hover:text-white"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingLocationId(null)}
                        className="text-xs text-gray-500 underline hover:text-gray-300"
                      >
                        Cancel
                      </button>
                    </form>
                  ) : (
                    <p className="mt-1 text-xs text-gray-500">
                      {new Date(m.playedAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                      {m.location ? ` at ${m.location}` : ""}
                    </p>
                  )}
                </div>
                {isAdmin && (
                  <div className="flex gap-2 text-xs">
                    <button
                      onClick={() => startLocationEdit(m)}
                      className="text-gray-400 underline hover:text-gray-200"
                    >
                      {m.location ? "Edit address" : "Add address"}
                    </button>
                    <button
                      onClick={() => reopen(m.id)}
                      className="text-gray-400 underline hover:text-gray-200"
                    >
                      Reopen
                    </button>
                    <button
                      onClick={() => removeMatch(m.id)}
                      className="text-gray-500 underline hover:text-red-400"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
