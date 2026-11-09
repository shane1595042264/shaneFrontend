import type { Metadata } from "next";
import { privatePageMetadata } from "@/lib/private-page-metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return privatePageMetadata("Session — Practice — Shane", `/practice/sessions/${encodeURIComponent(id)}`);
}

export default function PracticeSessionLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
