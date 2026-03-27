import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  transpilePackages: ["@shane/ui", "@shane/types"],
  basePath: "/journal",
};
export default nextConfig;
