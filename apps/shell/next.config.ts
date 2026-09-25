import path from "node:path";
import type { NextConfig } from "next";
import { COURSE_HOST } from "./lib/course-launch-url";
import { assertCrawlerDisallowCoverage } from "./lib/seo-routes-guard";
import { assertContrastFloor } from "./lib/contrast-guard";
import { assertNoHardCodedOgImages } from "./lib/og-image-guard";
import { assertSelectsAreNamed } from "./lib/select-name-guard";

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

// SHAN-522: fail the build if a route names its own opengraph-image path in
// metadata, which suppresses the :alt/:type/:width/:height tags and the
// cache-busting content hash that the file convention emits for free. Same
// execution story as the two guards above: build-time only.
assertNoHardCodedOgImages(path.join(process.cwd(), "app"));

// SHAN-532: fail the build if a <select> ships with no accessible name. Unlike
// the three guards above this one cannot be replaced by auditing the deployed
// page: four of the seven offenders it first caught render only inside a
// "+ Connect" form, and Lighthouse scores the tree it loads, so a control one
// click away is invisible to it forever. Same build-time-only execution story.
assertSelectsAreNamed([
  path.join(process.cwd(), "app"),
  path.join(process.cwd(), "components"),
  path.join(process.cwd(), "..", "..", "packages", "ui", "src"),
]);

const nextConfig: NextConfig = {
  transpilePackages: ["@shane/ui", "@shane/types"],
  // SHAN-504: turn OFF Next's streaming metadata. With it on, every
  // dynamically rendered route emits its metadata as
  // `<div hidden><Suspense fallback={null}>...</Suspense></div>` injected as the
  // FIRST child of <body> (next/dist/lib/metadata/metadata.js,
  // createMetadataComponents), and Fizz only fills it from the last script in
  // the document. Our three `cache: "no-store"` routes (/courses/[slug],
  // /trips, /trips/[slug]) were the only ones shipping that, so they served a
  // <head> with no <title> at all and eleven <meta> tags stranded in <body>,
  // which any head-only consumer outside Next's bot list reads as an untitled
  // page. This is the fix for that. `htmlLimitedBots` is the one switch Next
  // 15.5 exposes: base-server.js tests it against the request User-Agent and a
  // match means "this client cannot run JS, send blocking metadata", so a regex
  // matching every UA renders metadata into <head> for everyone. Next converts
  // the RegExp to its `.source` at config load (server/config.js) and re-tests
  // it per request (server/lib/streaming-metadata.ts).
  //
  // It is NOT the fix for the intermittent hydration discard (React #418) that
  // SHAN-504 was opened for, even though that bug is confined to the same three
  // routes. Measured on prod with cold-chunk hard reloads of
  // /courses/pi2-heist: 7 hits in 27 loads before this change, 3 in 19 after.
  // Removing the metadata boundary took the route from three pending Suspense
  // boundaries to one, and the survivor (the page-content boundary that
  // app/courses/loading.tsx creates, dehydrated until the end of the stream) is
  // the remaining suspect. Do not re-litigate auth: the error reproduces with
  // auth_token removed from localStorage and zero /api/auth/me requests.
  htmlLimitedBots: /.*/,
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
