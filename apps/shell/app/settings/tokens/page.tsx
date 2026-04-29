"use client";

import { useEffect, useState } from "react";
import { listTokens, revokeToken, type ApiToken } from "@/lib/api/tokens";
import { TokenList } from "@/components/settings/token-list";
import { MintTokenDialog } from "@/components/settings/mint-token-dialog";

export default function TokensPage() {
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMint, setShowMint] = useState(false);

  const refresh = () => {
    setLoading(true);
    listTokens().then(setTokens).finally(() => setLoading(false));
  };

  useEffect(refresh, []);

  return (
    <section>
      <header className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-medium">Personal Access Tokens</h2>
        <button onClick={() => setShowMint(true)} className="rounded bg-black px-3 py-1.5 text-sm text-white">
          New token
        </button>
      </header>
      {loading ? <p>Loading…</p> : <TokenList tokens={tokens} onRevoke={async (id) => { await revokeToken(id); refresh(); }} />}
      {showMint && <MintTokenDialog onClose={() => { setShowMint(false); refresh(); }} />}
    </section>
  );
}
