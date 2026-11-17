import type { EntryDetail } from "@/lib/api/journal";

// SHAN-705: "the blog is the public journal", as a step rather than a shared
// table. A journal entry becomes a blog draft by copy: the title from its
// first heading (or its date), the body from the entry plus its appends. The
// draft is a new blog post with its own history; editing it never touches the
// diary, and nothing is public until the author publishes the draft.

const LEADING_H1 = /^\s*#\s+(.+?)\s*#*\s*(?:\n|$)/;

function longDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** The blog backend caps a title at 200 characters. */
const MAX_TITLE = 200;

export function draftFromEntry(detail: EntryDetail): { title: string; content: string } {
  const body = detail.content ?? "";
  const h1 = body.match(LEADING_H1);
  const title = (h1 ? h1[1] : longDate(detail.entry.date)).slice(0, MAX_TITLE);
  // The heading became the title; left in, the post would open by repeating it.
  const lead = (h1 ? body.slice(h1[0].length) : body).trim();
  const appends = (detail.appends ?? []).map((a) => a.content.trim()).filter(Boolean);
  const content = [lead, ...appends].filter(Boolean).join("\n\n---\n\n");
  return { title, content };
}
