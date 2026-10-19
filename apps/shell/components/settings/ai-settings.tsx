"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { RelativeTime } from "@/lib/format-time";
import {
  PROVIDER_LABEL,
  addAiKey,
  formatUsd,
  getAiUsage,
  guessProvider,
  listAiKeys,
  recheckAiKey,
  removeAiKey,
  saveAiSettings,
  setPreferredModel,
  type AiKey,
  type AiProvider,
  type AiSettings,
  type UsageSummary,
} from "@/lib/api/ai";
import { PROVIDER_COLOR, UsageChart } from "@/components/settings/ai-usage-chart";

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

const GET_KEY_URL: Record<AiProvider, string> = {
  gemini: "https://aistudio.google.com/apikey",
  openai: "https://platform.openai.com/api-keys",
  anthropic: "https://console.anthropic.com/settings/keys",
  xai: "https://console.x.ai",
};

const MONOGRAM: Record<AiProvider, string> = { gemini: "G", openai: "O", anthropic: "A", xai: "X" };

const quiet =
  "inline-flex h-8 items-center rounded-full px-3 text-[13px] text-gray-300 ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/[0.06] hover:text-white active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50";

/** Which key Explain will use right now: the same rule as the server's chooseKey. */
function activeKeyId(keys: AiKey[], settings: AiSettings | null): string | null {
  const ok = keys.filter((k) => k.status === "ok");
  return (ok.find((k) => k.provider === settings?.preferredProvider) ?? ok[0])?.id ?? null;
}

/**
 * SHAN-596: Settings > AI. Keys for Explain (paste only the key; the provider
 * is read from its format and the key is checked before it is saved), which
 * provider and model to use, whether notes become knowledge cards, and what
 * all of it has cost.
 */
export function AiSettingsPanel() {
  const reduce = useReducedMotion() ?? false;
  const [keys, setKeys] = useState<AiKey[] | null>(null);
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    listAiKeys()
      .then((r) => {
        setKeys(r.keys);
        setSettings(r.settings);
      })
      .catch((e: unknown) => setLoadError(e instanceof Error ? e.message : "Couldn't load your AI settings"));
  }, []);

  const replaceKey = (k: AiKey) =>
    setKeys((prev) => {
      const list = prev ?? [];
      return list.some((x) => x.id === k.id || x.provider === k.provider)
        ? list.map((x) => (x.id === k.id || x.provider === k.provider ? k : x))
        : [...list, k];
    });

  const active = keys ? activeKeyId(keys, settings) : null;

  return (
    <div className="space-y-14">
      <section aria-labelledby="ai-keys-heading">
        <h2 id="ai-keys-heading" className="text-lg font-semibold tracking-tight text-white">
          AI keys
        </h2>
        <p className="mt-1.5 max-w-[60ch] text-sm leading-relaxed text-gray-400">
          Explain runs on your own key. Paste it below: the provider is worked out from the key, it is checked with
          one tiny call, then stored encrypted and never shown again.
        </p>

        <AddKeyForm onAdded={replaceKey} />

        {loadError && (
          <p role="alert" className="mt-4 text-sm text-red-300">
            {loadError}
          </p>
        )}

        <div className="mt-6 space-y-3">
          {keys === null && !loadError ? (
            [0, 1].map((i) => <div key={i} className="h-[112px] animate-pulse rounded-2xl bg-white/[0.03]" />)
          ) : keys && keys.length === 0 ? (
            <div className="rounded-2xl p-5 ring-1 ring-inset ring-white/[0.07]">
              <p className="text-sm text-gray-200">No keys yet.</p>
              <p className="mt-1 text-sm text-gray-400">Get one from any of these, then paste it above:</p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {(Object.keys(GET_KEY_URL) as AiProvider[]).map((p) => (
                  <li key={p}>
                    <a href={GET_KEY_URL[p]} target="_blank" rel="noreferrer" className={quiet}>
                      {PROVIDER_LABEL[p]} &#8599;
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {keys?.map((k) => (
                <motion.div
                  key={k.id}
                  layout={!reduce}
                  initial={reduce ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.3, ease: EASE_OUT_EXPO }}
                >
                  <KeyCard
                    k={k}
                    isActive={k.id === active}
                    isPreferred={settings?.preferredProvider === k.provider}
                    onChange={replaceKey}
                    onRemoved={() => setKeys((prev) => (prev ?? []).filter((x) => x.id !== k.id))}
                    onPrefer={async () => {
                      setSettings(await saveAiSettings({ preferredProvider: k.provider }));
                    }}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </section>

      {settings && (
        <section aria-labelledby="ai-knowledge-heading">
          <div className="flex items-start justify-between gap-6 rounded-2xl p-5 ring-1 ring-inset ring-white/[0.07]">
            <div>
              <h2 id="ai-knowledge-heading" className="text-[15px] font-medium text-white">
                Turn my notes into Knowledge cards
              </h2>
              <p className="mt-1 max-w-[56ch] text-sm leading-relaxed text-gray-400">
                New notes and explanations are filed into Knowledge as cards. Knowledge is public; only the words you
                selected and the note go in, never the text around them.
              </p>
            </div>
            <Switch
              checked={settings.notesToKnowledge}
              label="Turn my notes into Knowledge cards"
              onChange={async (next) => {
                setSettings({ ...settings, notesToKnowledge: next });
                try {
                  setSettings(await saveAiSettings({ notesToKnowledge: next }));
                } catch {
                  setSettings({ ...settings, notesToKnowledge: !next });
                }
              }}
            />
          </div>
        </section>
      )}

      <UsageSection />
    </div>
  );
}

function Switch({ checked, label, onChange }: { checked: boolean; label: string; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative mt-1 h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? "bg-teal-400/80" : "bg-white/[0.12]"}`}
    >
      <span
        aria-hidden="true"
        className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-300 ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function AddKeyForm({ onAdded }: { onAdded: (k: AiKey) => void }) {
  const reduce = useReducedMotion() ?? false;
  const [value, setValue] = useState("");
  const [shown, setShown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<AiKey | null>(null);
  const guess = useMemo(() => guessProvider(value), [value]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!value.trim() || busy) return;
    setBusy(true);
    setError(null);
    setAdded(null);
    try {
      const k = await addAiKey(value.trim());
      onAdded(k);
      setAdded(k);
      setValue("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add that key");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-5">
      <label htmlFor="ai-key-input" className="sr-only">
        API key
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <input
            id="ai-key-input"
            type={shown ? "text" : "password"}
            autoComplete="off"
            spellCheck={false}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
              setAdded(null);
            }}
            placeholder="Paste an API key"
            className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.03] pl-4 pr-36 font-mono text-[14px] text-white placeholder:font-sans placeholder:text-gray-400 transition-colors focus:border-white/25 focus:outline-none"
          />
          <div className="absolute inset-y-0 right-2 flex items-center gap-1.5">
            <AnimatePresence mode="popLayout" initial={false}>
              {guess.provider ? (
                <motion.span
                  key={guess.provider}
                  initial={reduce ? false : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.05] px-2 py-0.5 text-[11px] text-gray-200 ring-1 ring-inset ring-white/10"
                >
                  <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full" style={{ background: PROVIDER_COLOR[guess.provider] }} />
                  {PROVIDER_LABEL[guess.provider]}
                </motion.span>
              ) : null}
            </AnimatePresence>
            <button
              type="button"
              onClick={() => setShown((s) => !s)}
              className="rounded-md px-1.5 py-1 text-[11px] text-gray-400 hover:text-white"
              aria-pressed={shown}
            >
              {shown ? "Hide" : "Show"}
            </button>
          </div>
        </div>
        <button
          type="submit"
          disabled={!value.trim() || busy || (!guess.provider && !!guess.reason)}
          className="inline-flex h-12 shrink-0 items-center justify-center rounded-full bg-white px-6 text-sm font-medium text-black transition-[background-color,transform] hover:bg-gray-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-gray-400"
        >
          {busy ? "Checking..." : "Add key"}
        </button>
      </div>

      <div aria-live="polite" className="min-h-6 pt-2 text-sm">
        {busy && guess.provider && (
          <p className="flex items-center gap-2 text-gray-300">
            <span aria-hidden="true" className="note-shimmer inline-block h-1.5 w-16 rounded-full" />
            Checking with {PROVIDER_LABEL[guess.provider]}: finding the cheapest model that answers
          </p>
        )}
        {!busy && !guess.provider && guess.reason && value.trim().length >= 8 && <p className="text-amber-200/90">{guess.reason}</p>}
        {error && (
          <p role="alert" className="text-red-300">
            {error}
          </p>
        )}
        {added && (
          <p className="text-teal-200">
            {PROVIDER_LABEL[added.provider]} key added. Explain will use {added.defaultModel} unless you pick another
            model.
          </p>
        )}
      </div>
    </form>
  );
}

function KeyCard({
  k,
  isActive,
  isPreferred,
  onChange,
  onRemoved,
  onPrefer,
}: {
  k: AiKey;
  isActive: boolean;
  isPreferred: boolean;
  onChange: (k: AiKey) => void;
  onRemoved: () => void;
  onPrefer: () => Promise<void>;
}) {
  const [busy, setBusy] = useState<"check" | "remove" | "model" | "prefer" | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ok = k.status === "ok";

  const run = async (kind: NonNullable<typeof busy>, fn: () => Promise<void>) => {
    setBusy(kind);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work");
    } finally {
      setBusy(null);
    }
  };

  return (
    <article
      className={`spot rounded-2xl p-5 ring-1 ring-inset transition-colors ${
        isActive ? "bg-white/[0.035] ring-white/[0.14]" : "bg-white/[0.015] ring-white/[0.07]"
      }`}
    >
      <div className="flex flex-wrap items-start gap-4">
        <span
          aria-hidden="true"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[15px] font-semibold"
          style={{ background: `${PROVIDER_COLOR[k.provider]}26`, color: PROVIDER_COLOR[k.provider] }}
        >
          {MONOGRAM[k.provider]}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[15px] font-medium text-white">{PROVIDER_LABEL[k.provider]}</h3>
            <span className="font-mono text-[12px] text-gray-400">{"•••• "}{k.keyHint}</span>
            {isActive && (
              <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] text-gray-200 ring-1 ring-inset ring-white/10">
                Used for Explain
              </span>
            )}
          </div>
          <p className={`mt-1 text-[13px] ${ok ? "text-gray-400" : "text-amber-200/90"}`}>
            <span
              aria-hidden="true"
              className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle ${ok ? "bg-teal-300" : "bg-amber-300"}`}
            />
            {ok ? "Working" : `Failing: ${k.lastError ?? "check the key"}`}
            <span className="text-gray-400">
              {" · checked "}
              <RelativeTime iso={k.lastCheckedAt} />
            </span>
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <label htmlFor={`model-${k.id}`} className="sr-only">
          Model for {PROVIDER_LABEL[k.provider]}
        </label>
        <select
          id={`model-${k.id}`}
          value={k.preferredModel ?? ""}
          disabled={busy !== null}
          onChange={(e) =>
            run("model", async () => onChange(await setPreferredModel(k.id, e.target.value || null)))
          }
          className="h-8 max-w-full rounded-lg border border-white/10 bg-white/[0.03] px-2.5 font-mono text-[12px] text-gray-200 focus:border-white/25 focus:outline-none"
        >
          <option value="">Cheapest that works ({k.defaultModel})</option>
          {k.models.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        {!isPreferred && (
          <button type="button" className={quiet} disabled={busy !== null || !ok} onClick={() => run("prefer", onPrefer)}>
            {busy === "prefer" ? "Saving..." : "Use first"}
          </button>
        )}
        <button
          type="button"
          className={quiet}
          disabled={busy !== null}
          onClick={() => run("check", async () => onChange(await recheckAiKey(k.id)))}
        >
          {busy === "check" ? "Checking..." : "Re-check"}
        </button>
        {confirmRemove ? (
          <span className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={busy !== null}
              onClick={() =>
                run("remove", async () => {
                  await removeAiKey(k.id);
                  onRemoved();
                })
              }
              className="inline-flex h-8 items-center rounded-full bg-red-500/90 px-3 text-[13px] font-medium text-white hover:bg-red-500"
            >
              {busy === "remove" ? "Removing..." : "Remove key"}
            </button>
            <button type="button" className={quiet} onClick={() => setConfirmRemove(false)}>
              Keep
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmRemove(true)}
            className="inline-flex h-8 items-center rounded-full px-3 text-[13px] text-gray-400 transition-colors hover:bg-red-500/10 hover:text-red-300"
          >
            Remove
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-300">
          {error}
        </p>
      )}
    </article>
  );
}

function UsageSection() {
  const [days, setDays] = useState(30);
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    getAiUsage(days)
      .then((s) => !cancelled && setSummary(s))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : "Couldn't load usage"));
    return () => {
      cancelled = true;
    };
  }, [days]);

  const t = summary?.totals;
  const tiles = t
    ? [
        { label: "Tokens", value: (t.inputTokens + t.outputTokens).toLocaleString(), sub: `${t.inputTokens.toLocaleString()} in, ${t.outputTokens.toLocaleString()} out` },
        { label: "Estimated cost", value: formatUsd(t.costMicroUsd), sub: "at list prices" },
        { label: "Calls", value: t.calls.toLocaleString(), sub: "explanations and key checks" },
      ]
    : [];

  return (
    <section aria-labelledby="ai-usage-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="ai-usage-heading" className="text-lg font-semibold tracking-tight text-white">
            Usage
          </h2>
          <p className="mt-1.5 text-sm text-gray-400">Every call made with your keys.</p>
        </div>
        <div className="flex gap-1" role="group" aria-label="Period">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={days === d}
              onClick={() => setDays(d)}
              className={`inline-flex h-8 items-center rounded-full px-3 text-[13px] transition-colors ${
                days === d ? "bg-white/[0.08] text-white ring-1 ring-inset ring-white/15" : "text-gray-400 hover:text-white"
              }`}
            >
              {d} days
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-4 text-sm text-red-300">
          {error}
        </p>
      )}

      {!summary ? (
        <div className="mt-5 h-64 animate-pulse rounded-2xl bg-white/[0.03]" />
      ) : (
        <>
          <dl className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {tiles.map((tile) => (
              <div key={tile.label} className="rounded-2xl bg-white/[0.02] p-4 ring-1 ring-inset ring-white/[0.07]">
                <dt className="text-xs text-gray-400">{tile.label}</dt>
                <dd className="mt-1.5 font-mono text-2xl tabular-nums tracking-tight text-white">{tile.value}</dd>
                <dd className="mt-0.5 text-xs text-gray-400">{tile.sub}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-6 rounded-2xl p-5 ring-1 ring-inset ring-white/[0.07]">
            <p className="mb-4 text-sm text-gray-300">Tokens per day</p>
            <UsageChart summary={summary} />
          </div>

          {summary.byModel.length > 0 && (
            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <div>
                <h3 className="text-sm font-medium text-gray-200">By model</h3>
                <ul className="mt-2 divide-y divide-white/[0.06]">
                  {summary.byModel.map((m) => (
                    <li key={`${m.provider}/${m.model}`} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                      <span className="flex min-w-0 items-center gap-2">
                        <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-sm" style={{ background: PROVIDER_COLOR[m.provider] }} />
                        <span className="truncate font-mono text-[12.5px] text-gray-200">{m.model}</span>
                      </span>
                      <span className="shrink-0 font-mono text-[12.5px] tabular-nums text-gray-400">
                        {(m.inputTokens + m.outputTokens).toLocaleString()} tok, {formatUsd(m.costMicroUsd)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-200">Recent calls</h3>
                <ul className="mt-2 divide-y divide-white/[0.06]">
                  {summary.recent.slice(0, 8).map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                      <span className="min-w-0">
                        <span className="block truncate text-gray-200">
                          {r.feature === "explain" ? `Explain on ${r.surface ?? "a page"}` : "Key check"}
                        </span>
                        <span className="block truncate font-mono text-[11.5px] text-gray-400">{r.model}</span>
                      </span>
                      <span className="shrink-0 text-right font-mono text-[12px] tabular-nums text-gray-400">
                        <span className="block">{(r.inputTokens + r.outputTokens).toLocaleString()} tok</span>
                        <RelativeTime iso={r.createdAt} />
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
