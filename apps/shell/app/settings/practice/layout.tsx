import type { Metadata } from "next";
import { privatePageMetadata } from "@/lib/private-page-metadata";

export const metadata: Metadata = privatePageMetadata("Practice settings — Settings — Shane", "/settings/practice");

export default function SettingsPracticeLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
