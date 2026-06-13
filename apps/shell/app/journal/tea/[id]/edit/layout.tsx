import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Edit tea entry — Journal — Shane",
};

export default function TeaEntryEditLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
