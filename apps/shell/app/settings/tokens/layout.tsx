import type { Metadata } from "next";
import { privatePageMetadata } from "@/lib/private-page-metadata";

export const metadata: Metadata = privatePageMetadata("Account — Settings — Shane", "/settings/tokens");

export default function SettingsTokensLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
