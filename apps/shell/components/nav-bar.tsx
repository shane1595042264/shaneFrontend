"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import { UserMenu } from "@/components/user-menu";
import { LoginButton } from "@/components/login-button";

// Ties the hamburger's aria-controls to the panel it owns.
const MOBILE_MENU_ID = "mobile-nav-menu";

export function NavBar() {
  const { user, loading } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const toggleRef = useRef<HTMLButtonElement>(null);

  // Close mobile menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // The panel is a disclosure, so Escape must dismiss it and hand focus back to
  // the toggle — otherwise a keyboard user who opens the menu has no way to
  // close it and lands on <body> with no anchor in the tab order.
  useEffect(() => {
    if (!menuOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setMenuOpen(false);
      toggleRef.current?.focus();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const navLinks = [
    { href: "/", label: "Table", exact: true },
    { href: "/journal", label: "Journal" },
    { href: "/rng-capitalist", label: "RNG" },
    { href: "/knowledge", label: "Knowledge" },
  ];

  function linkClass(href: string, exact?: boolean) {
    const isActive = exact ? pathname === href : pathname.startsWith(href);
    return `transition-colors ${isActive ? "text-white" : "text-gray-400 hover:text-white"}`;
  }

  return (
    <nav className="relative flex items-center justify-between px-4 md:px-6 py-4 border-b border-white/10 print:hidden">
      <Link
        href="/"
        className="text-xl font-bold tracking-tight hover:opacity-80 transition-opacity"
      >
        Shane.
      </Link>

      {/* Desktop nav */}
      <div className="hidden md:flex items-center gap-6 text-sm">
        {navLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={linkClass(link.href, link.exact)}
          >
            {link.label}
          </Link>
        ))}
        {!loading && (user ? <UserMenu user={user} /> : <LoginButton />)}
      </div>

      {/* Mobile hamburger button */}
      <button
        ref={toggleRef}
        type="button"
        className="md:hidden flex items-center justify-center w-8 h-8 text-gray-400 hover:text-white transition-colors"
        onClick={() => setMenuOpen((prev) => !prev)}
        aria-label={menuOpen ? "Close menu" : "Open menu"}
        aria-expanded={menuOpen}
        // Only point at the panel while it exists, so the accessibility tree
        // never carries a dangling aria-controls target (same rule as
        // element-search.tsx).
        aria-controls={menuOpen ? MOBILE_MENU_ID : undefined}
      >
        {menuOpen ? (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="4" y1="4" x2="16" y2="16" />
            <line x1="16" y1="4" x2="4" y2="16" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="5" x2="17" y2="5" />
            <line x1="3" y1="10" x2="17" y2="10" />
            <line x1="3" y1="15" x2="17" y2="15" />
          </svg>
        )}
      </button>

      {/* Mobile menu overlay */}
      <AnimatePresence>
        {menuOpen && (
          <>
            {/* Click-catcher only — it has no content and no keyboard
                affordance (Escape is the keyboard path), so keep it out of the
                accessibility tree. */}
            <div
              aria-hidden="true"
              className="fixed inset-0 z-40 md:hidden"
              onClick={() => setMenuOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              id={MOBILE_MENU_ID}
              className="absolute top-full left-0 right-0 z-50 md:hidden border-b border-white/10 bg-zinc-950"
            >
              <div className="flex flex-col px-4 py-3 gap-3 text-sm">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`${linkClass(link.href, link.exact)} py-1`}
                  >
                    {link.label}
                  </Link>
                ))}
                {!loading &&
                  (user ? <UserMenu user={user} /> : <LoginButton />)}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </nav>
  );
}
