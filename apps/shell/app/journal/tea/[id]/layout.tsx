import type { Metadata } from "next";

// Static rather than generateMetadata: tea entries are auth-gated (AuthGate +
// per-entry PIN), so an SSR fetch of the entry would 401 (getAuthHeaders is
// browser-only), and private entry titles should not leak into tab history.
export const metadata: Metadata = {
  title: "Tea entry — Journal — Shane",
};

export default function TeaEntryLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
