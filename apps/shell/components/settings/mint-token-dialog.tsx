"use client";

import { useEffect, useState } from "react";
import { mintToken } from "@/lib/api/tokens";
import { useFocusTrap } from "@/lib/use-focus-trap";

const SCOPE_OPTIONS = [
  "entries:write",
  "suggestions:write",
  "comments:write",
  "reactions:write",
] as const;

export function MintTokenDialog({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>([]);
  const [raw, setRaw] = useState<string | null>(null);

  const dismissable = raw === null;
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
    if (!name.trim()) return;
    const res = await mintToken(name.trim(), scopes);
    setRaw(res.token);
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
                <label key={s} className="block text-sm">
                  <input
                    type="checkbox"
                    checked={scopes.includes(s)}
                    onChange={(e) => setScopes((cur) => e.target.checked ? [...cur, s] : cur.filter((x) => x !== s))}
                  /> {s}
                </label>
              ))}
            </fieldset>
            <div className="flex gap-2">
              <button onClick={submit} disabled={!name.trim()} className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50">
                Create
              </button>
              <button onClick={onClose} className="rounded border px-3 py-1.5 text-sm">Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
