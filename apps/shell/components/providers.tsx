"use client";

import { AuthProvider } from "@/lib/auth-context";

export function Providers({ children }: { children: React.ReactNode }) {
  // No GoogleOAuthProvider here on purpose (SHAN-496). Mounting it injects
  // accounts.google.com/gsi/client, and at the root that meant every visitor on
  // every page paid for the SDK and Google's third-party cookie — readers who
  // never sign in included. It now lives on <LoginButton>, which mounts it when
  // someone actually reaches for sign-in, so activating it remounts one leaf
  // instead of the whole tree under this provider.
  return <AuthProvider>{children}</AuthProvider>;
}
