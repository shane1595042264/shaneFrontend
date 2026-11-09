import type { Metadata } from "next";
import { privatePageMetadata } from "@/lib/private-page-metadata";

export const metadata: Metadata = privatePageMetadata("Session history — Practice — Shane", "/practice/history");

export default function PracticeHistoryLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
