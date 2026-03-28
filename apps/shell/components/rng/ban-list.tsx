"use client";
import type { Ban } from "@/lib/rng-api";

export function BanList({ bans }: { bans: Ban[] }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Banned Categories</h3>
      {bans.length === 0 ? <p className="text-gray-600 text-sm">No active bans.</p> : (
        <div className="space-y-2">
          {bans.map((ban) => {
            const daysLeft = Math.ceil((new Date(ban.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            return (
              <div key={ban.id} className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                <p className="text-sm text-red-400 font-medium">{ban.genericCategory}</p>
                <p className="text-xs text-gray-500">{daysLeft} days left</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
