"use client";

import { useEffect, useState } from "react";
import { mintToken } from "@/lib/api/tokens";
import { useFocusTrap } from "@/lib/use-focus-trap";

const SCOPE_OPTIONS = [
  { value: "entries:write", label: "entries:write — create/edit journal entries" },
  { value: "suggestions:write", label: "suggestions:write — submit edit suggestions" },
  { value: "comments:write", label: "comments:write — post comments" },
  { value: "reactions:write", label: "reactions:write — add reactions" },
  { value: "knowledge:write", label: "knowledge:write — push vocab/notes (e.g. Nibbler)" },
] as const;

export function MintTokenDialog({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>([]);
  const [raw, setRaw] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dismissable = raw === null && !saving;
  const containerRef = useFocusTrap<HTMLDivElement>();

  useEffect(() => {
    if (!dismissable) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dismissable, onClose]);

  const submit = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await mintToken(name.trim(), scopes);
      setRaw(res.token);
    } catch (err: any) {
      setError(err?.message ?? "Failed to create token");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="mint-token-dialog-title"
      className="fixed inset-0 bg-black/50 p-4"
      onClick={(e) => {
        if (dismissable && e.target === e.currentTarget) onClose();
      }}
    >
      <div className="mx-auto mt-20 max-w-md rounded bg-white p-6 shadow">
        {raw ? (
          <>
            <h3 id="mint-token-dialog-title" className="mb-2 font-medium">Token created — copy it now</h3>
            <p className="mb-3 text-xs text-gray-500">This is the only time you'll see this value.</p>
            <pre className="mb-4 break-all rounded bg-gray-100 p-2 font-mono text-sm">{raw}</pre>
            <button onClick={onClose} className="rounded bg-black px-3 py-1.5 text-sm text-white">Done</button>
          </>
        ) : (
          <>
            <h3 id="mint-token-dialog-title" className="mb-3 font-medium">New token</h3>
            <label className="mb-2 block text-sm">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="mb-4 w-full rounded border px-2 py-1" />
            <fieldset className="mb-4">
              <legend className="mb-1 text-sm">Scopes</legend>
              {SCOPE_OPTIONS.map((s) => (
                <label key={s.value} className="block text-sm">
                  <input
                    type="checkbox"
                    checked={scopes.includes(s.value)}
                    onChange={(e) => setScopes((cur) => e.target.checked ? [...cur, s.value] : cur.filter((x) => x !== s.value))}
                  /> {s.label}
                </label>
              ))}
            </fieldset>
            {error && (
              <p role="alert" className="mb-3 text-sm text-red-600">{error}</p>
            )}
            <div className="flex gap-2">
              <button onClick={submit} disabled={!name.trim() || saving} className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50">
                {saving ? "Creating…" : "Create"}
              </button>
              <button onClick={onClose} disabled={saving} className="rounded border px-3 py-1.5 text-sm disabled:opacity-50">Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
