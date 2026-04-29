import type { ApiToken } from "@/lib/api/tokens";

export function TokenList({ tokens, onRevoke }: { tokens: ApiToken[]; onRevoke: (id: string) => void }) {
  if (tokens.length === 0) return <p className="text-sm text-gray-500">No tokens yet.</p>;
  return (
    <ul className="divide-y rounded border">
      {tokens.map((t) => (
        <li key={t.id} className="flex items-center justify-between p-3">
          <div>
            <div className="font-medium">{t.name}</div>
            <div className="text-xs text-gray-500">
              {t.scopes.join(", ") || "no scopes"} · last used {t.lastUsedAt ? new Date(t.lastUsedAt).toLocaleDateString() : "never"}
              {t.revokedAt && " · REVOKED"}
            </div>
          </div>
          {!t.revokedAt && (
            <button onClick={() => onRevoke(t.id)} className="text-sm text-red-600 hover:underline">
              Revoke
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
