import type { ElementConfig } from "@shane/types";

// Symbol is "Bg", not "Bl": Bilibili already holds "Bl" in the external
// elements list in lib/element-registry.ts.
const manifest: ElementConfig = {
  id: "blog",
  symbol: "Bg",
  name: "Blog",
  category: "creative",
  type: "internal",
  route: "/blog",
  status: "live",
  description: "Public long-form writing — the open counterpart to the invite-only journal.",
};

export default manifest;
