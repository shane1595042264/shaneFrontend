"use client";

import { useEffect, useState } from "react";
import { listTokens, revokeToken, type ApiToken } from "@/lib/api/tokens";
import { TokenList } from "@/components/settings/token-list";
import { MintTokenDialog } from "@/components/settings/mint-token-dialog";

export default function TokensPage() {
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMint, setShowMint] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => {
    setLoading(true);
    setError(null);
    listTokens()
      .then(setTokens)
      .catch((err: any) => setError(err?.message ?? "Failed to load tokens"))
      .finally(() => setLoading(false));
  };

  useEffect(refresh, []);

  const handleRevoke = async (id: string) => {
    setError(null);
    try {
      await revokeToken(id);
      refresh();
    } catch (err: any) {
      setError(err?.message ?? "Failed to revoke token");
    }
  };

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
      {loading ? <p>Loading…</p> : <TokenList tokens={tokens} onRevoke={handleRevoke} />}
      {showMint && <MintTokenDialog onClose={() => { setShowMint(false); refresh(); }} />}
    </section>
  );
}
