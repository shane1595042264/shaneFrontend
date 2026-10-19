"use client";

import { useEffect, useRef, useState } from "react";
import Link from "@/components/transition-link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import type { AuthUser } from "@/lib/auth-api";
import { SETTINGS_SECTIONS } from "@/lib/settings-sections";

// Ties the trigger's aria-controls to the panel it owns.
const PANEL_ID = "user-menu-panel";

function displayName(user: AuthUser) {
  return user.name || user.email.split("@")[0];
}

function Avatar({ user, size }: { user: AuthUser; size: "sm" | "md" }) {
  const box = size === "sm" ? "w-7 h-7 text-xs" : "w-9 h-9 text-sm";
  return user.avatarUrl ? (
    <img
      src={user.avatarUrl}
      alt=""
      className={`${box} shrink-0 rounded-full`}
      referrerPolicy="no-referrer"
    />
  ) : (
    <div
      aria-hidden="true"
      className={`${box} shrink-0 rounded-full bg-white/20 flex items-center justify-center font-medium`}
    >
      {(user.name || user.email)[0].toUpperCase()}
    </div>
  );
}

/** Who is signed in. Shared by the dropdown and the mobile panel. */
function ProfileSummary({ user }: { user: AuthUser }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar user={user} size="md" />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-white">{displayName(user)}</p>
        <p className="truncate text-xs text-gray-400">{user.email}</p>
      </div>
    </div>
  );
}

/**
 * The settings pages and sign-out (SHAN-598). Same items in the dropdown and
 * the mobile panel; only the container differs.
 */
function MenuItems({ onNavigate }: { onNavigate?: () => void }) {
  const { logout } = useAuth();
  const pathname = usePathname();

  return (
    <>
      <ul className="flex flex-col gap-0.5">
        {SETTINGS_SECTIONS.map((section) => {
          const active = pathname.startsWith(section.href);
          return (
            <li key={section.href}>
              <Link
                href={section.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={`block rounded-lg px-3 py-2 transition-colors hover:bg-white/5 ${
                  active ? "bg-white/[0.06]" : ""
                }`}
              >
                <span className="block text-sm text-gray-200">{section.menuLabel}</span>
                <span className="block text-xs text-gray-400">{section.hint}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <div aria-hidden="true" className="my-1 h-px bg-white/10" />
      <button
        type="button"
        onClick={() => {
          logout();
          onNavigate?.();
        }}
        className="w-full rounded-lg px-3 py-2 text-left text-sm text-gray-300 transition-colors hover:bg-white/5 hover:text-white"
      >
        Sign out
      </button>
    </>
  );
}

/**
 * `inline` is for the mobile nav panel, which is already a popover: a second
 * dropdown nested inside it would open off a 28px avatar at the bottom of a
 * list, so there the profile and its items are laid out flat instead.
 */
export function UserMenu({
  user,
  variant = "dropdown",
}: {
  user: AuthUser;
  variant?: "dropdown" | "inline";
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const triggerRef = useRef<HTMLButtonElement>(null);

  // A settings link navigates without unmounting the nav, so close on arrival.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Disclosure semantics, same as the nav's hamburger: Escape dismisses and
  // hands focus back to the trigger rather than stranding it on <body>.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (variant === "inline") {
    return (
      <div className="mt-2 border-t border-white/10 px-3 pt-4">
        <ProfileSummary user={user} />
        <div className="mt-3 -mx-3">
          <MenuItems />
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={open ? PANEL_ID : undefined}
        className="flex items-center gap-2 rounded-full transition-colors hover:text-white"
      >
        <Avatar user={user} size="sm" />
        <span className="hidden sm:inline text-sm">{displayName(user)}</span>
      </button>

      {open && (
        <>
          <div aria-hidden="true" className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            id={PANEL_ID}
            className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-white/10 bg-zinc-900/95 p-1.5 shadow-xl shadow-black/40 backdrop-blur-xl"
          >
            <div className="px-3 pb-3 pt-2">
              <ProfileSummary user={user} />
            </div>
            <div aria-hidden="true" className="mb-1 h-px bg-white/10" />
            <MenuItems onNavigate={() => setOpen(false)} />
          </div>
        </>
      )}
    </div>
  );
}
