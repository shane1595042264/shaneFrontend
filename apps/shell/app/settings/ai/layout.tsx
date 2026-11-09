import type { Metadata } from "next";
import { privatePageMetadata } from "@/lib/private-page-metadata";

export const metadata: Metadata = privatePageMetadata("AI keys — Settings — Shane", "/settings/ai");

export default function SettingsAiLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
