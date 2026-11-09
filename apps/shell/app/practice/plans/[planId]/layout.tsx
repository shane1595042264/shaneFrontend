import type { Metadata } from "next";
import { privatePageMetadata } from "@/lib/private-page-metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ planId: string }>;
}): Promise<Metadata> {
  const { planId } = await params;
  return privatePageMetadata("Training plan — Practice — Shane", `/practice/plans/${planId}`);
}

export default function PracticePlanLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
