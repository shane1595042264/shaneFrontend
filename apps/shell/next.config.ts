import type { NextConfig } from "next";
import { COURSE_HOST } from "./lib/course-launch-url";

const nextConfig: NextConfig = {
  transpilePackages: ["@shane/ui", "@shane/types"],
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"}/api/:path*` },
      // SHAN-477: hosted courses are proxied through shanejli.com so corporate
      // DNS filters never see the Railway hostname. See lib/course-launch-url.ts
      // for why. The trailing slash on the first destination is load-bearing:
      // the origin answers the slashless form with a 308 to an absolute Railway
      // URL, which would put the blocked host right back in the address bar.
      { source: "/learn/:slug", destination: `https://${COURSE_HOST}/courses/:slug/` },
      { source: "/learn/:slug/:path*", destination: `https://${COURSE_HOST}/courses/:slug/:path*` },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};
export default nextConfig;
