import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Trip group day — Shane",
};

export default function TripGroupDayLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
