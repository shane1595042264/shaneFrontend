import path from "node:path";
import type { NextConfig } from "next";
import { COURSE_HOST } from "./lib/course-launch-url";
import { assertCrawlerDisallowCoverage } from "./lib/seo-routes-guard";
import { assertContrastFloor } from "./lib/contrast-guard";

// SHAN-497: fail the build if an auth-gated page is missing from
// CRAWLER_DISALLOW, which would leak it into robots.txt and sitemap.xml as a
// soft-404. This file is evaluated only by the Node build/dev process, never by
// the serverless runtime, so the check cannot affect production requests.
assertCrawlerDisallowCoverage(path.join(process.cwd(), "app"));

// SHAN-500: fail the build if a gray text utility that cannot reach WCAG AA on
// the site's near-black background creeps back in. Same execution story as the
// guard above: build-time only. packages/ui/src is included because its
// markdown editor ships into every authoring surface, and `turbo build` runs
// this from apps/shell, so the monorepo root is two levels up.
assertContrastFloor([
  path.join(process.cwd(), "app"),
  path.join(process.cwd(), "components"),
  path.join(process.cwd(), "lib"),
  path.join(process.cwd(), "..", "..", "packages", "ui", "src"),
]);

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
