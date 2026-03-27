import { redirect } from "next/navigation";
import { fetchElements, getDefaultElements } from "@/lib/elements";

interface PageProps {
  params: Promise<{ symbol: string }>;
}

export default async function ElementPage({ params }: PageProps) {
  const { symbol } = await params;

  let elements;
  try {
    elements = await fetchElements();
  } catch {
    elements = getDefaultElements();
  }

  const element = elements.find(
    (el) => el.symbol.toLowerCase() === symbol.toLowerCase()
  );

  if (!element) {
    redirect("/");
  }

  if (element.status === "coming-soon") {
    redirect("/");
  }

  if (element.type === "external" && element.url) {
    redirect(element.url);
  }

  if (element.type === "internal" && element.route) {
    redirect(element.route);
  }

  redirect("/");
}
