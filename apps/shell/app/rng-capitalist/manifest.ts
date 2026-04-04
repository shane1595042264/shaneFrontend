import type { ElementConfig } from "@shane/types";

const manifest: ElementConfig = {
  id: "rng-capitalist",
  symbol: "Rc",
  name: "RNG Capitalist",
  category: "tools",
  type: "internal",
  route: "/rng-capitalist",
  status: "live",
  description: "D20-based spending decision tool",
  authRequired: true,
};

export default manifest;
