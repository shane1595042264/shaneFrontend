"use client";

import { MermaidDiagram } from "@/components/mermaid-diagram";
import type { TeachVisual } from "@/lib/course-lessons";

/**
 * SHAN-713: the visual every teach card carries. A diagram, an image from the
 * site's own store, or an emoji. The backend validator only lets an image
 * through as a /api/journal/images/<id> path, which the browser fetches
 * same-origin, so no outside host ever sees a learner open a card.
 */
export function TeachVisualView({ visual }: { visual: TeachVisual }) {
  const caption = visual.caption ? (
    <figcaption className="mt-2 text-sm text-gray-400">{visual.caption}</figcaption>
  ) : null;

  if (visual.kind === "emoji") {
    return (
      <figure className="flex items-center gap-4" data-anno-skip="">
        <span
          aria-hidden="true"
          className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl bg-white/[0.04] text-5xl ring-1 ring-inset ring-white/[0.08]"
        >
          {visual.emoji}
        </span>
        {visual.caption && <figcaption className="text-sm text-gray-400">{visual.caption}</figcaption>}
      </figure>
    );
  }

  if (visual.kind === "image") {
    return (
      <figure data-anno-skip="">
        {/* Plain <img>: the bytes come from the site's own image route, which
            the Next image optimizer is not configured for. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={visual.src}
          alt={visual.alt}
          loading="lazy"
          className="max-h-[22rem] w-full rounded-xl border border-white/10 bg-black/20 object-contain"
        />
        {caption}
      </figure>
    );
  }

  return (
    <figure className="[&_.not-prose]:my-0" data-anno-skip="">
      <MermaidDiagram code={visual.mermaid} />
      {caption}
    </figure>
  );
}
