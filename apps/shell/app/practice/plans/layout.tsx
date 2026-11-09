import type { Metadata } from "next";
import { privatePageMetadata } from "@/lib/private-page-metadata";

export const metadata: Metadata = privatePageMetadata("Training plans — Practice — Shane", "/practice/plans");

export default function PracticePlansLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
