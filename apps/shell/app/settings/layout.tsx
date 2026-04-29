"use client";

import { useAuth } from "@/lib/auth-context";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8">Loading…</div>;
  if (!user) return <div className="p-8">Sign in to access settings.</div>;
  return (
    <div className="mx-auto max-w-3xl p-8">
      <h1 className="mb-6 text-2xl font-semibold">Settings</h1>
      <nav className="mb-6 flex gap-4 border-b pb-2 text-sm">
        <a href="/settings/tokens" className="hover:underline">Tokens</a>
      </nav>
      {children}
    </div>
  );
}
