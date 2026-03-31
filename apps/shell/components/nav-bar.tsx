"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { UserMenu } from "@/components/user-menu";
import { LoginButton } from "@/components/login-button";

export function NavBar() {
  const { user, loading } = useAuth();

  return (
    <nav className="flex items-center justify-between px-6 py-4 border-b border-white/10">
      <Link href="/" className="text-xl font-bold tracking-tight hover:opacity-80 transition-opacity">
        Shane.
      </Link>
      <div className="flex items-center gap-6 text-sm text-gray-400">
        <Link href="/" className="hover:text-white transition-colors">
          Table
        </Link>
        {!loading && (user ? <UserMenu user={user} /> : <LoginButton />)}
      </div>
    </nav>
  );
}
