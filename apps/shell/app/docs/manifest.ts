import type { ElementConfig } from "@shane/types";

const manifest: ElementConfig = {
  id: "documentation",
  symbol: "Dc",
  name: "Documentation",
  category: "tools",
  type: "internal",
  route: "/docs",
  status: "live",
  description: "Developer docs for every API on this site. Agents: start at /llms.txt.",
};

export default manifest;
