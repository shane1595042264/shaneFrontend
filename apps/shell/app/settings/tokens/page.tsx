"use client";

import { useEffect, useState } from "react";
import { listTokens, revokeToken, type ApiToken } from "@/lib/api/tokens";
import { TokenList } from "@/components/settings/token-list";
import { MintTokenDialog } from "@/components/settings/mint-token-dialog";
import { FocusTrappedDiv } from "@/components/focus-trapped-div";

export default function TokensPage() {
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMint, setShowMint] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revokeConfirmId, setRevokeConfirmId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const refresh = () => {
    setLoading(true);
    setError(null);
    listTokens()
      .then(setTokens)
      .catch((err: any) => setError(err?.message ?? "Failed to load tokens"))
      .finally(() => setLoading(false));
  };

  useEffect(refresh, []);

  useEffect(() => {
    if (!revokeConfirmId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !revokingId) setRevokeConfirmId(null);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [revokeConfirmId, revokingId]);

  const handleRevoke = async (id: string) => {
    setError(null);
    setRevokingId(id);
    try {
      await revokeToken(id);
      setRevokeConfirmId(null);
      refresh();
    } catch (err: any) {
      setError(err?.message ?? "Failed to revoke token");
    } finally {
      setRevokingId(null);
    }
  };

  const tokenToRevoke = revokeConfirmId
    ? tokens.find((t) => t.id === revokeConfirmId) ?? null
    : null;

  return (
    <section>
      <header className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-medium">Personal Access Tokens</h2>
        <button onClick={() => setShowMint(true)} className="rounded bg-black px-3 py-1.5 text-sm text-white">
          New token
        </button>
      </header>
      {error && (
        <p role="alert" className="mb-3 text-sm text-red-600">{error}</p>
      )}
      {loading ? <p>Loading…</p> : <TokenList tokens={tokens} onRevoke={(id) => setRevokeConfirmId(id)} />}
      {showMint && <MintTokenDialog onClose={() => { setShowMint(false); refresh(); }} />}

      {tokenToRevoke && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => { if (!revokingId) setRevokeConfirmId(null); }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="pat-revoke-heading"
        >
          <FocusTrappedDiv
            className="bg-gray-900 border border-white/10 rounded-lg p-6 max-w-sm w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="pat-revoke-heading" className="text-lg font-semibold text-white mb-2">
              Revoke &ldquo;{tokenToRevoke.name}&rdquo;?
            </h3>
            <p className="text-sm text-gray-400 mb-6">
              Any agent or script using this token will start failing immediately. This cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setRevokeConfirmId(null)}
                disabled={!!revokingId}
                className="px-4 py-2 text-sm bg-white/5 hover:bg-white/10 disabled:opacity-50 text-gray-400 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRevoke(tokenToRevoke.id)}
                disabled={!!revokingId}
                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded transition-colors"
              >
                {revokingId ? "Revoking..." : "Revoke"}
              </button>
            </div>
          </FocusTrappedDiv>
        </div>
      )}
    </section>
  );
}
