"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import type { AuthUser } from "@/lib/auth-api";

export function UserMenu({ user }: { user: AuthUser }) {
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 hover:text-white transition-colors"
      >
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt=""
            className="w-7 h-7 rounded-full"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-xs font-medium">
            {(user.name || user.email)[0].toUpperCase()}
          </div>
        )}
        <span className="hidden sm:inline text-sm">
          {user.name || user.email.split("@")[0]}
        </span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 z-50 w-48 rounded-lg border border-white/10 bg-zinc-900 shadow-xl py-1">
            <div className="px-3 py-2 text-xs text-gray-400 truncate border-b border-white/10">
              {user.email}
            </div>
            <button
              onClick={() => {
                logout();
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
            >
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
