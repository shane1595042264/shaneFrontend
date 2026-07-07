import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "New tea entry — Journal — Shane",
};

export default function TeaNewLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
