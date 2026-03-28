"use client";
import type { Decision } from "@/lib/rng-api";

const RESULT_BADGE: Record<string, string> = {
  approved: "bg-green-500/20 text-green-400", denied: "bg-red-500/20 text-red-400",
  necessity: "bg-blue-500/20 text-blue-400", banned: "bg-red-500/20 text-red-400", too_expensive: "bg-red-500/20 text-red-400",
};

export function HistoryList({ decisions }: { decisions: Decision[] }) {
  if (decisions.length === 0) return (
    <div><h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">History</h3><p className="text-gray-600 text-sm">No decisions yet.</p></div>
  );
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">History</h3>
      <div className="space-y-2">
        {decisions.map((d) => (
          <div key={d.id} className="flex items-center gap-3 bg-white/5 rounded-lg p-3">
            {d.avatarUrl && <img src={d.avatarUrl} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white truncate">{d.productName}</p>
              <p className="text-xs text-gray-500">${d.price.toFixed(2)} &middot; {d.genericCategory}</p>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded font-medium ${RESULT_BADGE[d.result] || ""}`}>{d.result}</span>
            <span className="text-xs text-gray-600">{new Date(d.createdAt).toLocaleDateString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
