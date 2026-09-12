// apps/shell/lib/api/journal-activity.ts
//
// Read side of the journal audit trail (SHAN-483 backend, SHAN-484 UI).
// Membership-gated like every other journal read, so both calls carry the
// viewer's token and 403 for a non-member.
import { getAuthHeaders } from "@/lib/auth-api";
import { API_URL } from "@/lib/api-url";
import type { JournalAuthor } from "@/lib/api/journal";

/** Mirrors journal_activity_action in the backend schema. */
export type JournalActivityAction =
  | "entry.create"
  | "entry.delete"
  | "entry.revert"
  | "append.create"
  | "append.update"
  | "append.delete"
  | "comment.create"
  | "comment.update"
  | "comment.delete"
  | "suggestion.create"
  | "suggestion.approve"
  | "suggestion.reject"
  | "suggestion.withdraw";

export interface JournalActivityActor extends JournalAuthor {
  /**
   * Set when the write came from a PAT rather than a browser session — the
   * whole reason actor_token_id exists. `name` is the token's name, which is
   * what lets the feed say "Shane via jira-worker". It can be null if the
   * token was revoked (ON DELETE SET NULL anonymizes the label but keeps the
   * history).
   */
  agent: { tokenId: string; name: string | null } | null;
}

export interface JournalActivityRow {
  id: string;
  entryId: string | null;
  entryDate: string;
  action: JournalActivityAction;
  targetType: string;
  targetId: string | null;
  actorId: string;
  detail: Record<string, unknown> | null;
  createdAt: string;
  actor: JournalActivityActor;
}

export interface ActivityPage {
  activity: JournalActivityRow[];
  nextCursor: string | null;
}

/**
 * The cursor here is the createdAt of the last row on the previous page — an
 * ISO timestamp, not the isoDate cursor the entries list uses (SHAN-373).
 */
interface ActivityOpts {
  limit?: number;
  cursor?: string;
}

function queryString(opts: ActivityOpts): string {
  const qs = new URLSearchParams();
  if (opts.limit !== undefined) qs.set("limit", String(opts.limit));
  if (opts.cursor) qs.set("cursor", opts.cursor);
  const s = qs.toString();
  return s ? `?${s}` : "";
}

async function fetchActivity(path: string, signal?: AbortSignal): Promise<ActivityPage> {
  const res = await fetch(`${API_URL}${path}`, { headers: getAuthHeaders(), signal });
  if (!res.ok) throw new Error("Failed to load activity");
  const json = await res.json();
  // Coalesce a missing nextCursor to null: the two repos deploy independently,
  // and undefined would read as "there is more" and re-fetch page one forever.
  return { activity: json.activity ?? [], nextCursor: json.nextCursor ?? null };
}

/** Site-wide feed, newest first. */
export async function listActivity(
  opts: ActivityOpts = {},
  init?: { signal?: AbortSignal }
): Promise<ActivityPage> {
  return fetchActivity(`/api/journal/activity${queryString(opts)}`, init?.signal);
}

/** Same feed, scoped to one entry. */
export async function listEntryActivity(
  date: string,
  opts: ActivityOpts = {},
  init?: { signal?: AbortSignal }
): Promise<ActivityPage> {
  return fetchActivity(
    `/api/journal/entries/${date}/activity${queryString(opts)}`,
    init?.signal
  );
}
