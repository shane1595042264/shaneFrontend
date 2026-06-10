import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Trip groups — Shane",
};

export default function TripGroupsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
