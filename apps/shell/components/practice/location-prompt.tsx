"use client";

import { useEffect, useRef, useState } from "react";
import { listLocations, upsertLocation, type Location } from "@/lib/api/practice";

interface Props {
  // Resolves once the item is saved. A rejection keeps the prompt open with
  // the error so the same choice can be retried; null means skipped.
  onPick: (location: { id: string; name: string } | null) => Promise<void>;
}

export function LocationPrompt({ onPick }: Props) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // `saving` disables the controls a render late; the ref stops a second
  // click in the same frame from saving the item twice.
  const busyRef = useRef(false);

  useEffect(() => {
    listLocations().then(setLocations).catch((e) => setError(e.message));
  }, []);

  const finish = async (resolve: () => Promise<{ id: string; name: string } | null>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setSaving(true);
    setError(null);
    try {
      await onPick(await resolve());
    } catch (e) {
      setError((e as Error).message ?? "Failed to save");
      busyRef.current = false;
      setSaving(false);
    }
  };

  const submit = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    finish(async () => {
      const loc = await upsertLocation(trimmed);
      return { id: loc.id, name: loc.name };
    });
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
          aria-label="New location"
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
        onClick={() => finish(async () => null)}
        disabled={saving}
        className="mt-3 text-xs text-gray-400 hover:text-gray-300 disabled:opacity-50"
      >
        Skip (won't count toward solidification)
      </button>
      {saving && <p className="mt-2 text-xs text-gray-400">Saving…</p>}
      {error && <p role="alert" className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
