import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "New trip group — Shane",
};

export default function NewTripGroupLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
