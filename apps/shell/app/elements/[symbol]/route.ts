import { redirect, notFound } from "next/navigation";
import { fetchElements, getDefaultElements } from "@/lib/elements";

interface Params {
  params: Promise<{ symbol: string }>;
}

// Route Handler (not a Page) so redirects flush as real HTTP 307s instead of
// the meta-refresh fallback that streaming Server Components produce. See
// SHAN-196 for context.
export async function GET(_req: Request, { params }: Params) {
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
    notFound();
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
