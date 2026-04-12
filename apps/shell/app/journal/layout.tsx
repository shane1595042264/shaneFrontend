import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Journal — Shane",
  description:
    "AI-generated daily journal entries from Shane's life — workouts, code, travel, and more.",
  openGraph: {
    title: "Journal — Shane",
    description:
      "AI-generated daily journal entries from Shane's life — workouts, code, travel, and more.",
    url: "https://shanejli.com/journal",
    siteName: "Shane — Periodic Table of Life",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Journal — Shane",
    description:
      "AI-generated daily journal entries from Shane's life — workouts, code, travel, and more.",
  },
};

export default function JournalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col overflow-hidden" style={{ height: "calc(100dvh - 57px)" }}>
      <div className="flex-1 overflow-hidden px-3 md:px-6 py-4 md:py-6">
        {children}
      </div>
    </div>
  );
}
