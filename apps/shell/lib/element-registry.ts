import type { ElementConfig } from "@shane/types";

/**
 * Element registry — auto-discovers elements from route manifests.
 *
 * To add a new element:
 * 1. Create app/<route>/manifest.ts exporting an ElementConfig
 * 2. Add one import line below
 * That's it. No DB seed, no API call.
 */

import journalManifest from "@/app/journal/manifest";
import rngCapitalistManifest from "@/app/rng-capitalist/manifest";
import videoDownloaderManifest from "@/app/video-downloader/manifest";
import vocabularyManifest from "@/app/vocabulary/manifest";

// External links and coming-soon elements that don't have route folders
const externalElements: ElementConfig[] = [
  {
    id: "hardcore",
    symbol: "Hc",
    name: "Hardcore",
    category: "gaming",
    type: "internal",
    status: "coming-soon",
    description: "Minecraft Hardcore World",
  },
  {
    id: "inventory",
    symbol: "In",
    name: "Inventory",
    category: "tools",
    type: "internal",
    status: "coming-soon",
    description: "Wardrobe & item tracker",
  },
  {
    id: "github",
    symbol: "Gh",
    name: "GitHub",
    category: "projects",
    type: "external",
    url: "https://github.com/shane1595042264",
    status: "live",
    description: "GitHub profile & repos",
  },
  {
    id: "youtube",
    symbol: "Yt",
    name: "YouTube",
    category: "creative",
    type: "external",
    status: "coming-soon",
    description: "YouTube channel",
  },
  {
    id: "bilibili",
    symbol: "Bl",
    name: "Bilibili",
    category: "creative",
    type: "external",
    status: "coming-soon",
    description: "Bilibili channel",
  },
];

/** All registered elements — internal manifests + external/coming-soon */
export const allElements: ElementConfig[] = [
  journalManifest,
  rngCapitalistManifest,
  videoDownloaderManifest,
  vocabularyManifest,
  ...externalElements,
];
