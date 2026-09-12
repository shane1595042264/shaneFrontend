"use client";

import Link from "next/link";
import { RelativeTime } from "@/lib/format-time";
import type {
  JournalActivityAction,
  JournalActivityRow,
} from "@/lib/api/journal-activity";

/**
 * Shared renderer for the journal audit trail (SHAN-484, UI half of SHAN-479).
 *
 * Distinct from activity-sidebar.tsx, which shows integration activity
 * (GitHub/Strava/Calendar) for a date. This one shows who did what to the
 * journal itself.
 */

const ACTION_LABELS: Record<JournalActivityAction, string> = {
  "entry.create": "created the entry",
  "entry.delete": "deleted the entry",
  "entry.revert": "reverted the entry",
  "append.create": "added a sub-entry",
  "append.update": "edited a sub-entry",
  "append.delete": "removed a sub-entry",
  "comment.create": "commented",
  "comment.update": "edited a comment",
  "comment.delete": "deleted a comment",
  "suggestion.create": "suggested an edit",
  "suggestion.approve": "approved a suggestion",
  "suggestion.reject": "rejected a suggestion",
  "suggestion.withdraw": "withdrew a suggestion",
};

// Destructive actions read differently from additive ones at a glance, which is
// the point of an audit trail you skim.
const DESTRUCTIVE: ReadonlySet<JournalActivityAction> = new Set([
  "entry.delete",
  "append.delete",
  "comment.delete",
  "entry.revert",
  "suggestion.reject",
]);

function actionLabel(action: JournalActivityAction): string {
  return ACTION_LABELS[action] ?? action;
}

/**
 * "Shane via jira-worker" when a PAT made the write, plain name otherwise.
 * A revoked token leaves actor.agent set with a null name (ON DELETE SET NULL
 * on the backend), so the badge still says an agent did it — just not which.
 */
function ActorLine({ row }: { row: JournalActivityRow }) {
  const name = row.actor.name?.trim() || "Anonymous";
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      {row.actor.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={row.actor.avatarUrl}
          alt=""
          className="h-5 w-5 shrink-0 rounded-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : null}
      <span className="truncate text-gray-300">{name}</span>
      {row.actor.agent && (
        <span
          className="shrink-0 rounded bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-medium text-violet-300"
          title="Performed by an agent holding a personal access token"
        >
          via {row.actor.agent.name?.trim() || "revoked token"}
        </span>
      )}
    </span>
  );
}

export function ActivityRow({
  row,
  showEntryLink = true,
}: {
  row: JournalActivityRow;
  /** Off on the entry page, where every row is about the entry you're reading. */
  showEntryLink?: boolean;
}) {
  return (
    <li className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2 text-xs">
      <ActorLine row={row} />
      <span className={DESTRUCTIVE.has(row.action) ? "text-rose-300" : "text-gray-400"}>
        {actionLabel(row.action)}
      </span>
      {showEntryLink && (
        <Link
          href={`/journal/${row.entryDate}`}
          className="font-mono text-gray-400 transition-colors hover:text-gray-200"
        >
          {row.entryDate}
        </Link>
      )}
      <RelativeTime iso={row.createdAt} className="ml-auto shrink-0 text-gray-400" />
    </li>
  );
}

export function ActivityList({
  rows,
  showEntryLink = true,
}: {
  rows: JournalActivityRow[];
  showEntryLink?: boolean;
}) {
  return (
    <ul className="divide-y divide-white/10 rounded-md border border-white/10">
      {rows.map((row) => (
        <ActivityRow key={row.id} row={row} showEntryLink={showEntryLink} />
      ))}
    </ul>
  );
}
