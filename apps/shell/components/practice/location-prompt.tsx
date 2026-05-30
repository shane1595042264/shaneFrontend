"use client";

import { useEffect, useState } from "react";
import { listLocations, upsertLocation, type Location } from "@/lib/api/practice";

interface Props {
  onPick: (location: { id: string; name: string } | null) => void;
  onSkip: () => void;
}

export function LocationPrompt({ onPick, onSkip }: Props) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listLocations().then(setLocations).catch((e) => setError(e.message));
  }, []);

  const submit = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      const loc = await upsertLocation(trimmed);
      onPick({ id: loc.id, name: loc.name });
    } catch (e) {
      setError((e as Error).message ?? "Failed to save location");
      setSaving(false);
    }
  };

  return (
    <div className="rounded-md border border-white/10 bg-black/30 p-4">
      <h3 className="mb-2 text-sm font-medium">Where are you practicing?</h3>
      {locations.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {locations.map((l) => (
            <button
              key={l.id}
              type="button"
              disabled={saving}
              onClick={() => submit(l.name)}
              className="rounded-full border border-white/15 px-3 py-1 text-xs hover:bg-white/10 disabled:opacity-50"
            >
              {l.name}
            </button>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Or type a new one…"
          disabled={saving}
          onKeyDown={(e) => { if (e.key === "Enter") submit(input); }}
          className="flex-1 rounded border border-white/15 bg-black/40 px-3 py-1.5 text-sm focus:border-white/40 focus:outline-none disabled:opacity-50"
        />
        <button
          type="button"
          onClick={() => submit(input)}
          disabled={saving || !input.trim()}
          className="rounded bg-white px-3 py-1.5 text-sm text-black hover:bg-gray-200 disabled:opacity-50"
        >
          Save
        </button>
      </div>
      <button
        type="button"
        onClick={onSkip}
        className="mt-3 text-xs text-gray-500 hover:text-gray-300"
      >
        Skip (won't count toward solidification)
      </button>
      {error && <p role="alert" className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
