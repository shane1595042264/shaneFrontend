"use client";
import type { Ban } from "@/lib/rng-api";

export function BanList({ bans }: { bans: Ban[] }) {
  return (
    <div>
      {/*
        SHAN-533: h2, not h3. This is one of the three top-level sections
        app/rng-capitalist/page.tsx renders as siblings, and that page now has
        an h1 in its element bar — an h3 here would skip a level, which is the
        same heading-order failure SHAN-531 removed from /courses. The bans are
        <p>s, not headings, so h1 to h2 is the whole outline on this side.
        BanList is imported only by that page, so nothing else inherits this.
      */}
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Banned Categories</h2>
      {bans.length === 0 ? <p className="text-gray-400 text-sm">No active bans.</p> : (
        <div className="space-y-2">
          {bans.map((ban) => {
            const daysLeft = Math.ceil((new Date(ban.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            return (
              <div key={ban.id} className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                <p className="text-sm text-red-400 font-medium">{ban.genericCategory}</p>
                <p className="text-xs text-gray-400">{daysLeft} days left</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
