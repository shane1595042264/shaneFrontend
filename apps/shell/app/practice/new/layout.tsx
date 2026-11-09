import type { Metadata } from "next";
import { privatePageMetadata } from "@/lib/private-page-metadata";

export const metadata: Metadata = privatePageMetadata("New session — Practice — Shane", "/practice/new");

export default function PracticeNewLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
