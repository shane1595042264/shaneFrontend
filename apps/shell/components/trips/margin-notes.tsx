"use client";

import { useEffect, useState, type FormEvent } from "react";
import { RelativeTime } from "@/lib/format-time";
import type { TripGroupNote } from "@/lib/api/trip-groups";

/**
 * Google-Docs-style margin notes (SHAN-283). Rendered in a side column
 * next to the main content; each note shows its anchor (Group / Day N /
 * Day N · Activity), author, and time. Quick context like "this
 * restaurant costs $40 per person" or "remember to bring sunscreen".
 */

export interface NoteAnchorOption {
  value: string;
  label: string;
  anchorType: "group" | "day" | "activity";
  anchorDay?: number | null;
  anchorActivity?: string | null;
}

export function anchorLabel(n: TripGroupNote): string {
  if (n.anchorType === "group") return "Group";
  if (n.anchorType === "day") return `Day ${n.anchorDay}`;
  return `Day ${n.anchorDay} · ${n.anchorActivity}`;
}

export function NotesMargin({
  notes,
  anchorOptions,
  selectedAnchor,
  onSelectAnchor,
  canDelete,
  busy,
  onCreate,
  onDelete,
}: {
  notes: TripGroupNote[];
  anchorOptions: NoteAnchorOption[];
  /** Controlled anchor selection so "+ note" buttons in the content can preselect. */
  selectedAnchor: string;
  onSelectAnchor: (value: string) => void;
  canDelete: (n: TripGroupNote) => boolean;
  busy: boolean;
  onCreate: (anchor: NoteAnchorOption, body: string) => Promise<void>;
  onDelete: (noteId: string) => void;
}) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  // When a "+ note" button preselects an anchor, surface the composer.
  useEffect(() => {
    setError(null);
  }, [selectedAnchor]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const anchor = anchorOptions.find((o) => o.value === selectedAnchor);
    if (!anchor || !body.trim()) return;
    try {
      await onCreate(anchor, body.trim());
      setBody("");
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <aside aria-label="Notes" className="lg:sticky lg:top-6 lg:self-start">
      <h2 className="mb-2 text-sm font-medium text-gray-300">
        Notes
        {notes.length > 0 && (
          <span className="ml-2 rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-gray-400">
            {notes.length}
          </span>
        )}
      </h2>

      <form onSubmit={handleSubmit} className="mb-3 rounded-md border border-white/15 bg-black/30 p-2">
        <select
          value={selectedAnchor}
          onChange={(e) => onSelectAnchor(e.target.value)}
          aria-label="Note anchor"
          className="mb-1.5 block w-full rounded border border-white/15 bg-black/40 px-1.5 py-1 text-xs text-gray-300 focus:border-white/40 focus:outline-none"
        >
          {anchorOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={'e.g. "costs ~$40/person", "bring sunscreen"'}
          rows={2}
          maxLength={1000}
          aria-label="Note text"
          className="block w-full rounded border border-white/15 bg-black/40 px-2 py-1 text-xs text-white/90 focus:border-white/40 focus:outline-none"
        />
        {error && <p role="alert" className="mt-1 text-xs text-red-400">{error}</p>}
        <div className="mt-1.5 flex justify-end">
          <button
            type="submit"
            disabled={busy || !body.trim()}
            className="rounded bg-amber-500/80 px-2.5 py-1 text-xs font-medium text-black hover:bg-amber-500 disabled:opacity-50"
          >
            {busy ? "Adding…" : "Add note"}
          </button>
        </div>
      </form>

      {notes.length === 0 ? (
        <p className="text-xs text-gray-500">No notes yet.</p>
      ) : (
        <ul className="space-y-2">
          {notes.map((n) => (
            <li key={n.id} className="rounded-md border-l-2 border-amber-400/60 bg-amber-500/10 p-2">
              <p className="text-[10px] font-medium uppercase tracking-wide text-amber-300/90">
                {anchorLabel(n)}
              </p>
              <p className="mt-0.5 whitespace-pre-wrap text-xs text-white/90">{n.body}</p>
              <p className="mt-1 flex items-baseline justify-between text-[10px] text-gray-500">
                <span>
                  {n.authorName ?? "Anonymous"} · <RelativeTime iso={n.createdAt} />
                </span>
                {canDelete(n) && (
                  <button
                    type="button"
                    onClick={() => onDelete(n.id)}
                    className="text-red-400/70 hover:text-red-300"
                  >
                    delete
                  </button>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
