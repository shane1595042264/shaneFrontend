"use client";

import Link from "@/components/transition-link";
import { useEffect, useRef, useState } from "react";
import { listTokens, revokeToken, type ApiToken } from "@/lib/api/tokens";
import { TokenList, TokenListSkeleton } from "@/components/settings/token-list";
import { MintTokenDialog } from "@/components/settings/mint-token-dialog";
import { RevokeTokenDialog } from "@/components/settings/revoke-token-dialog";
import { TimezoneSection } from "@/components/settings/timezone-section";
import { LoadError } from "@/components/load-error";

export default function TokensPage() {
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  // Only the first fetch shows the skeleton. Refreshes after a mint or a
  // revoke keep the current list on screen so the page does not flash empty.
  const [loaded, setLoaded] = useState(false);
  const [showMint, setShowMint] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [revokeConfirmId, setRevokeConfirmId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  // Set by a confirmed revoke and read once when the dialog unmounts. The
  // focus trap hands focus back to the row's Revoke button that opened the
  // dialog, but that button leaves the DOM as soon as refresh() moves the token
  // into the revoked list, which would strand focus on <body>. Parent effects
  // run after the child's cleanup in the same commit, so this wins.
  const focusHeadingOnClose = useRef(false);

  useEffect(() => {
    if (revokeConfirmId !== null || !focusHeadingOnClose.current) return;
    focusHeadingOnClose.current = false;
    headingRef.current?.focus();
  }, [revokeConfirmId]);

  const refresh = () => {
    // A retry after a failed first load goes back to the skeleton, not to the
    // empty-state card, while it waits.
    if (loadError && tokens.length === 0) setLoaded(false);
    setLoadError(null);
    listTokens()
      .then(setTokens)
      .catch(() => setLoadError("Could not load your tokens."))
      .finally(() => setLoaded(true));
  };

  useEffect(refresh, []);

  const openRevoke = (id: string) => {
    setRevokeError(null);
    setRevokeConfirmId(id);
  };

  const closeRevoke = () => {
    setRevokeConfirmId(null);
    setRevokeError(null);
  };

  const handleRevoke = async (id: string) => {
    setRevokeError(null);
    setRevokingId(id);
    try {
      await revokeToken(id);
      focusHeadingOnClose.current = true;
      setRevokeConfirmId(null);
      refresh();
    } catch (err: unknown) {
      setRevokeError(err instanceof Error ? err.message : "Failed to revoke token");
    } finally {
      setRevokingId(null);
    }
  };

  const tokenToRevoke = revokeConfirmId
    ? tokens.find((t) => t.id === revokeConfirmId) ?? null
    : null;

  return (
    <div>
      <TimezoneSection />

      <section aria-labelledby="pat-heading">
        <header className="mb-4 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="min-w-0 flex-1">
            <h2
              id="pat-heading"
              ref={headingRef}
              tabIndex={-1}
              className="text-lg font-medium outline-none"
            >
              Personal access tokens
            </h2>
            <p className="mt-1 text-xs text-gray-400">
              Let agents and scripts write on your behalf, one scope at a time. The{" "}
              <Link
                href="/docs/auth"
                className="text-gray-200 underline decoration-white/30 underline-offset-2 transition-colors hover:text-white"
              >
                API docs
              </Link>{" "}
              show how to send one.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowMint(true)}
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-md bg-white px-4 text-sm font-medium text-black transition-colors hover:bg-gray-200"
          >
            New token
          </button>
        </header>

        {/* SHAN-632: a failed load used to show only the raw error ("Failed to
            fetch") with no way back but a full reload. */}
        {loadError && (
          <div className="mb-3">
            <LoadError message={loadError} onRetry={refresh} stale={tokens.length > 0} />
          </div>
        )}

        {/* A failed first load must not render the empty-state card, which would
            claim there are no tokens when the request simply never answered. */}
        {!loaded ? (
          <TokenListSkeleton />
        ) : loadError && tokens.length === 0 ? null : (
          <TokenList tokens={tokens} onRevoke={openRevoke} />
        )}
      </section>

      {showMint && (
        <MintTokenDialog
          onClose={() => {
            setShowMint(false);
            refresh();
          }}
        />
      )}

      {tokenToRevoke && (
        <RevokeTokenDialog
          token={tokenToRevoke}
          revoking={revokingId === tokenToRevoke.id}
          error={revokeError}
          onCancel={closeRevoke}
          onConfirm={() => handleRevoke(tokenToRevoke.id)}
        />
      )}
    </div>
  );
}
