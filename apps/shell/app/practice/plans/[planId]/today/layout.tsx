import type { Metadata } from "next";
import { privatePageMetadata } from "@/lib/private-page-metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ planId: string }>;
}): Promise<Metadata> {
  const { planId } = await params;
  return privatePageMetadata("Today's plan — Practice — Shane", `/practice/plans/${encodeURIComponent(planId)}/today`);
}

export default function PracticePlanTodayLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
