import type { ApiToken } from "@/lib/api/tokens";
import { RelativeTime } from "@/lib/format-time";

const LIST_CLASS =
  "divide-y divide-white/10 overflow-hidden rounded-lg border border-white/10 bg-white/[0.02]";

function TokenRow({
  token,
  onRevoke,
}: {
  token: ApiToken;
  onRevoke?: (id: string) => void;
}) {
  const revokedAt = token.revokedAt;
  return (
    <li className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-4 py-3.5">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {/*
            Revoked rows dim the name only. An opacity on the whole row would
            drag the text-gray-400 metadata below the 4.5:1 floor that
            lib/contrast-guard.ts enforces by class name and cannot see here.
          */}
          <span className={"font-medium " + (revokedAt ? "text-gray-400" : "text-white")}>
            {token.name}
          </span>
          {revokedAt && (
            <span className="rounded-full border border-white/15 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-gray-400">
              Revoked
            </span>
          )}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {token.scopes.length === 0 ? (
            <span className="text-xs text-gray-400">No scopes</span>
          ) : (
            token.scopes.map((scope) => (
              <code
                key={scope}
                className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[11px] leading-4 text-gray-200"
              >
                {scope}
              </code>
            ))
          )}
        </div>
        <p className="mt-1.5 text-xs text-gray-400">
          {revokedAt ? (
            <>
              Revoked <RelativeTime iso={revokedAt} />
            </>
          ) : (
            <>
              Last used {token.lastUsedAt ? <RelativeTime iso={token.lastUsedAt} /> : "never"}
            </>
          )}
          {" · "}
          Created <RelativeTime iso={token.createdAt} />
        </p>
      </div>
      {!revokedAt && onRevoke && (
        <button
          type="button"
          onClick={() => onRevoke(token.id)}
          aria-label={`Revoke ${token.name}`}
          className="min-h-9 shrink-0 rounded-md px-3 text-sm text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300"
        >
          Revoke
        </button>
      )}
    </li>
  );
}

export function TokenList({
  tokens,
  onRevoke,
}: {
  tokens: ApiToken[];
  onRevoke: (id: string) => void;
}) {
  const active = tokens.filter((t) => !t.revokedAt);
  const revoked = tokens.filter((t) => t.revokedAt);

  return (
    <div className="space-y-6">
      {active.length === 0 ? (
        <div className="rounded-lg border border-dashed border-white/15 px-6 py-10 text-center">
          <p className="text-sm font-medium text-white">No active tokens</p>
          <p className="mt-1 text-sm text-gray-400">
            Create one to let an agent or script write on your behalf.
          </p>
        </div>
      ) : (
        <ul className={LIST_CLASS}>
          {active.map((t) => (
            <TokenRow key={t.id} token={t} onRevoke={onRevoke} />
          ))}
        </ul>
      )}

      {revoked.length > 0 && (
        <details className="group">
          <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 text-sm text-gray-400 transition-colors hover:text-white [&::-webkit-details-marker]:hidden">
            <svg
              aria-hidden="true"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3.5 w-3.5 transition-transform group-open:rotate-90"
            >
              <path d="M6 4l4 4-4 4" />
            </svg>
            {revoked.length} revoked {revoked.length === 1 ? "token" : "tokens"}
          </summary>
          <ul className={LIST_CLASS + " mt-3"}>
            {revoked.map((t) => (
              <TokenRow key={t.id} token={t} />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

export function TokenListSkeleton() {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Loading tokens…</span>
      <div aria-hidden="true" className={LIST_CLASS}>
        {[0, 1, 2].map((i) => (
          <div key={i} className="px-4 py-3.5">
            <div className="h-4 w-36 animate-pulse rounded bg-white/10" />
            <div className="mt-2 flex gap-1.5">
              <div className="h-5 w-24 animate-pulse rounded-md bg-white/5" />
              <div className="h-5 w-28 animate-pulse rounded-md bg-white/5" />
            </div>
            <div className="mt-2 h-3 w-48 animate-pulse rounded bg-white/5" />
          </div>
        ))}
      </div>
    </div>
  );
}
