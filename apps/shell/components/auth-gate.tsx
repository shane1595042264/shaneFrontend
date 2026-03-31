"use client";

import { useAuth } from "@/lib/auth-context";
import { LoginButton } from "@/components/login-button";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold">Sign in required</h2>
          <p className="text-gray-400 text-sm">
            This feature requires authentication. Sign in with Google to continue.
          </p>
        </div>
        <LoginButton />
      </div>
    );
  }

  return <>{children}</>;
}
