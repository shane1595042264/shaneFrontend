import type { ElementConfig } from "@shane/types";

const manifest: ElementConfig = {
  id: "who-owes-me",
  symbol: "Wm",
  name: "Who Owes Me",
  category: "tools",
  type: "internal",
  route: "/who-owes-me",
  status: "live",
  description: "Track money you've lent out",
  authRequired: true,
};

export default manifest;
