"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { mintToken } from "@/lib/api/tokens";
import { useEscapeKey } from "@/lib/use-escape-key";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { useScrollLock } from "@/lib/use-scroll-lock";

const SCOPE_OPTIONS = [
  { value: "entries:write", description: "Write journal entries, blog posts, courses, scoreboard, tea and skincare" },
  { value: "suggestions:write", description: "Submit edit suggestions" },
  { value: "comments:write", description: "Post comments" },
  { value: "reactions:write", description: "Add reactions" },
  { value: "knowledge:write", description: "Push vocabulary and notes (what Nibbler uses)" },
  { value: "practice:write", description: "Configure and log practice sessions" },
  { value: "trips:write", description: "Upload, edit and delete your own trip HTML" },
] as const;

const PRIMARY_BUTTON =
  "min-h-11 rounded-md bg-white px-4 text-sm font-medium text-black transition-colors hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50";
const SECONDARY_BUTTON =
  "min-h-11 rounded-md bg-white/10 px-4 text-sm text-gray-200 transition-colors hover:bg-white/20 disabled:opacity-50";

export function MintTokenDialog({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>([]);
  const [raw, setRaw] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<"copied" | "error" | null>(null);
  const copyButtonRef = useRef<HTMLButtonElement>(null);

  const dismissable = raw === null && !saving;
  const containerRef = useFocusTrap<HTMLDivElement>();
  useScrollLock();
  useEscapeKey(onClose, dismissable);

  // The focus trap only places focus on mount. When the form is swapped for
  // the created-token view, the Create button that held focus unmounts, so
  // hand focus to the primary action of the new view.
  useEffect(() => {
    if (raw) copyButtonRef.current?.focus();
  }, [raw]);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await mintToken(name.trim(), scopes);
      setRaw(res.token);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create token");
    } finally {
      setSaving(false);
    }
  };

  const toggleScope = (value: string, checked: boolean) => {
    setScopes((cur) => (checked ? [...cur, value] : cur.filter((x) => x !== value)));
  };

  const handleCopy = async () => {
    if (!raw) return;
    try {
      await navigator.clipboard.writeText(raw);
      setCopyFeedback("copied");
    } catch {
      setCopyFeedback("error");
    }
    setTimeout(() => setCopyFeedback(null), 2000);
  };

  const srMessage =
    copyFeedback === "copied"
      ? "Token copied to clipboard"
      : copyFeedback === "error"
        ? "Failed to copy token"
        : "";

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="mint-token-dialog-title"
      aria-describedby="mint-token-dialog-description"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={(e) => {
        if (dismissable && e.target === e.currentTarget) onClose();
      }}
    >
      {/* scheme-dark: the panel scrolls on short viewports and Chrome paints a
          light-mode scrollbar on it otherwise, since the site never sets
          color-scheme globally. */}
      <div className="max-h-full w-full max-w-lg overflow-y-auto overscroll-contain scheme-dark rounded-lg border border-white/15 bg-gray-950 p-6">
        {raw ? (
          <>
            <h3 id="mint-token-dialog-title" className="text-lg font-semibold text-white">
              Token created
            </h3>
            <p id="mint-token-dialog-description" className="mt-1 text-sm text-gray-400">
              Copy it now. This is the only time it will be shown.
            </p>
            <div className="mt-4 rounded-md border border-white/15 bg-black/40 p-3">
              <code className="block break-all font-mono text-sm text-white select-all">{raw}</code>
            </div>
            {copyFeedback === "error" && (
              <p role="alert" className="mt-3 text-sm text-red-400">
                Could not copy automatically. Select the token above and copy it by hand.
              </p>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={onClose} className={SECONDARY_BUTTON}>
                Done
              </button>
              <button
                ref={copyButtonRef}
                type="button"
                onClick={handleCopy}
                className={PRIMARY_BUTTON}
              >
                {copyFeedback === "copied" ? "Copied" : "Copy token"}
              </button>
            </div>
            <div role="status" aria-live="polite" className="sr-only">
              {srMessage}
            </div>
          </>
        ) : (
          <form onSubmit={submit} noValidate>
            <h3 id="mint-token-dialog-title" className="text-lg font-semibold text-white">
              New token
            </h3>
            <p id="mint-token-dialog-description" className="mt-1 text-sm text-gray-400">
              Name it after whatever will use it, and grant only the scopes that thing needs.
            </p>

            <label className="mt-5 block space-y-1">
              <span className="text-xs text-gray-400">Name</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. nibbler forwarder"
                maxLength={100}
                autoComplete="off"
                className="min-h-11 w-full rounded-md border border-white/15 bg-black/40 px-3 text-sm text-white placeholder:text-gray-400 focus:border-white/40 focus:outline-none"
              />
            </label>

            <fieldset className="mt-5">
              <legend className="text-xs text-gray-400">Scopes</legend>
              <ul className="mt-1 divide-y divide-white/10 overflow-hidden rounded-md border border-white/15">
                {SCOPE_OPTIONS.map((s) => {
                  const checked = scopes.includes(s.value);
                  return (
                    <li key={s.value}>
                      <label
                        className={
                          "flex cursor-pointer items-start gap-3 px-3 py-2.5 transition-colors hover:bg-white/5" +
                          (checked ? " bg-white/5" : "")
                        }
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => toggleScope(s.value, e.target.checked)}
                          className="mt-0.5 h-4 w-4 shrink-0 scheme-dark accent-white"
                        />
                        <span className="min-w-0">
                          <span className="block font-mono text-sm text-white">{s.value}</span>
                          <span className="block text-xs text-gray-400">{s.description}</span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2 text-xs text-gray-400">
                {scopes.length === 0
                  ? "No scopes selected. Scoped writes will be refused. Routes that only need a sign-in still work."
                  : `${scopes.length} of ${SCOPE_OPTIONS.length} scopes selected`}
              </p>
            </fieldset>

            {error && (
              <p role="alert" className="mt-4 text-sm text-red-400">
                {error}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={onClose} disabled={saving} className={SECONDARY_BUTTON}>
                Cancel
              </button>
              <button type="submit" disabled={!name.trim() || saving} className={PRIMARY_BUTTON}>
                {saving ? "Creating…" : "Create token"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
