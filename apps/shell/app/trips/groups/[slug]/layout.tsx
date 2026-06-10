import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Trip group — Shane",
};

export default function TripGroupDetailLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
