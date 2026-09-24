"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

const SECTIONS = [{ href: "/settings/tokens", label: "Tokens" }];

function Frame({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-3xl px-4 py-10 md:px-8">{children}</div>;
}

export function SettingsAuthShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();

  if (loading) {
    return (
      <Frame>
        <p role="status" className="text-sm text-gray-400">
          Loading…
        </p>
      </Frame>
    );
  }

  if (!user) {
    return (
      <Frame>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Settings</h1>
        <p className="mt-2 text-sm text-gray-400">
          Sign in to manage your time zone and personal access tokens.
        </p>
      </Frame>
    );
  }

  return (
    <Frame>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-white">Settings</h1>
        <p className="mt-1 text-sm text-gray-400">
          Signed in as <span className="text-gray-200">{user.email}</span>
        </p>
      </header>
      <nav
        aria-label="Settings sections"
        className="mb-8 flex gap-6 border-b border-white/10 text-sm"
      >
        {SECTIONS.map((section) => {
          const active = pathname.startsWith(section.href);
          return (
            <Link
              key={section.href}
              href={section.href}
              aria-current={active ? "page" : undefined}
              className={
                "-mb-px border-b-2 pb-2.5 transition-colors " +
                (active
                  ? "border-white text-white"
                  : "border-transparent text-gray-400 hover:text-white")
              }
            >
              {section.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </Frame>
  );
}
