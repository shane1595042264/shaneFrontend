"use client";

import { useState } from "react";
import { createPlayer, deletePlayer, type Player } from "@/lib/api/scoreboard";
import { colorStyles } from "./palette";

export function AddPlayerForm({
  players,
  refresh,
  onCreated,
}: {
  players: Player[];
  refresh: () => Promise<void>;
  onCreated: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createPlayer({ name: name.trim() });
      setName("");
      await onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add the player");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    setError(null);
    try {
      await deletePlayer(id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove the player");
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-white/10 bg-black/20 p-4">
      <h2 className="text-lg font-medium">Players</h2>
      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}
      <ul className="flex flex-wrap gap-2">
        {players.map((p) => (
          <li
            key={p.id}
            className={`flex items-center gap-2 rounded-full border ${colorStyles(p.color).border} px-3 py-1 text-sm`}
          >
            <span
              className={`h-2 w-2 rounded-full ${colorStyles(p.color).solid}`}
              aria-hidden="true"
            />
            {p.name}
            <button
              onClick={() => remove(p.id)}
              aria-label={`Remove ${p.name}`}
              className="text-gray-500 hover:text-red-400"
            >
              &times;
            </button>
          </li>
        ))}
        {players.length === 0 && (
          <li className="text-sm italic text-gray-500">No players yet.</li>
        )}
      </ul>
      <form onSubmit={submit} className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={80}
          placeholder="Player name"
          className="w-full max-w-xs rounded-md border border-white/20 bg-black/30 px-2 py-1.5 text-sm text-white placeholder-gray-500 focus:border-white/40 focus:outline-none"
        />
        <button
          type="submit"
          disabled={saving || name.trim().length === 0}
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-white px-4 text-sm font-medium text-black hover:bg-gray-200 disabled:opacity-50"
        >
          Add
        </button>
      </form>
    </div>
  );
}
