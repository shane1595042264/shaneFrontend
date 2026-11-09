import type { Metadata } from "next";
import { privatePageMetadata } from "@/lib/private-page-metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ itemId: string }>;
}): Promise<Metadata> {
  const { itemId } = await params;
  return privatePageMetadata("Item — Practice — Shane", `/practice/items/${itemId}`);
}

export default function PracticeItemLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
