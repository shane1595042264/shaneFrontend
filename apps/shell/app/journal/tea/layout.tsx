import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tea — Journal — Shane",
};

export default function TeaIndexLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
