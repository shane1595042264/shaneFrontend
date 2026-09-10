// apps/shell/app/journal/access/page.tsx
//
// Owner-only access management for the invite-only journal
// (SHAN-476, Phase 3 of SHAN-472).
//
// Client component by necessity, not preference: every endpoint here is
// browser-session only (a PAT is rejected outright) and the JWT lives in
// localStorage, so a Server Component would send no Authorization header and
// read back a 403. The surrounding layout's JournalAccessGate has already
// handled "signed out" and "not a member"; what is left for this page to decide
// is owner vs. plain member.
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { RelativeTime } from "@/lib/format-time";
import { InlineErrorState } from "@/components/inline-error-state";
import { humanizeActionError, humanizeError } from "@/lib/humanize-error";
import {
  approveAccessRequest,
  getMyJournalAccess,
  inviteJournalMember,
  listAccessRequests,
  listJournalMembers,
  rejectAccessRequest,
  revokeJournalMember,
  type JournalAccessRequest,
  type JournalAccessState,
  type JournalMember,
} from "@/lib/api/journal-access";

export default function JournalAccessPage() {
  const { user, loading: authLoading } = useAuth();
  const [access, setAccess] = useState<JournalAccessState | null>(null);
  const [requests, setRequests] = useState<JournalAccessRequest[]>([]);
  const [members, setMembers] = useState<JournalMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Per-row action state. `busyId` is the request or member id currently in
  // flight, so only that row's buttons disable rather than the whole page.
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteNotice, setInviteNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const state = await getMyJournalAccess();
      setAccess(state);
      // A plain member gets a 403 from every list below, so don't ask.
      if (state.role !== "owner") return;
      const [nextRequests, nextMembers] = await Promise.all([
        listAccessRequests(),
        listJournalMembers(),
      ]);
      setRequests(nextRequests);
      setMembers(nextMembers);
    } catch (e) {
      setError(humanizeError(e, "Failed to load journal access"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    void load();
  }, [authLoading, load, user?.id]);

  // Approve/reject each move a request out of the queue AND change membership,
  // so refetch instead of patching two lists in place.
  const decide = useCallback(
    async (id: string, action: "approve" | "reject") => {
      setBusyId(id);
      setActionError(null);
      try {
        if (action === "approve") await approveAccessRequest(id);
        else await rejectAccessRequest(id);
        await load();
      } catch (e) {
        setActionError(humanizeActionError(e, "Couldn't update that request"));
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  const revoke = useCallback(
    async (userId: string) => {
      setBusyId(userId);
      setActionError(null);
      try {
        await revokeJournalMember(userId);
        setConfirmRevokeId(null);
        await load();
      } catch (e) {
        setActionError(humanizeActionError(e, "Couldn't remove that member"));
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  const invite = useCallback(async () => {
    const email = inviteEmail.trim();
    if (!email) return;
    setInviting(true);
    setInviteError(null);
    setInviteNotice(null);
    try {
      const member = await inviteJournalMember(email);
      setInviteEmail("");
      setInviteNotice(`${member.name?.trim() || member.email} can now read the journal.`);
      await load();
    } catch (e) {
      setInviteError(humanizeActionError(e, "Couldn't send that invite"));
    } finally {
      setInviting(false);
    }
  }, [inviteEmail, load]);

  if (authLoading || loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8" aria-busy={true}>
        <div className="mb-2 h-7 w-40 rounded bg-white/8 animate-pulse" />
        <div className="mb-6 h-3 w-80 rounded bg-white/8 animate-pulse" />
        <div role="status" aria-label="Loading journal access" className="space-y-4">
          <span className="sr-only">Loading journal access…</span>
          <div className="h-24 rounded-md border border-white/10 bg-white/[0.03]" />
          <div className="h-24 rounded-md border border-white/10 bg-white/[0.03]" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <InlineErrorState
        message={error}
        onRetry={() => void load()}
        backHref="/journal"
        backLabel="Back to journal"
      />
    );
  }

  // Reachable only for a member who is not the owner — the gate above already
  // turned away everyone with no access at all.
  if (access?.role !== "owner") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="mb-2 text-2xl font-semibold">Journal access</h1>
        <p className="text-sm text-gray-400">
          Only the journal owner can invite members and answer access requests. You already
          have access yourself.
        </p>
        <Link
          href="/journal"
          className="mt-4 inline-block text-sm text-gray-400 hover:text-gray-300"
        >
          &larr; all entries
        </Link>
      </div>
    );
  }

  const pending = requests.filter((r) => r.status === "pending");
  // Rejecting isn't final — re-requesting flips the same row back to pending —
  // so decided requests stay visible instead of vanishing from the page.
  const decided = [...requests.filter((r) => r.status !== "pending")].sort((a, b) =>
    (b.decidedAt ?? b.createdAt).localeCompare(a.decidedAt ?? a.createdAt),
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-semibold">Journal access</h1>
      <p className="mb-6 text-sm text-gray-400">
        The journal is invite-only. Approve requests, invite people by email, and remove
        members here.
      </p>

      {actionError && (
        <p
          role="alert"
          className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400"
        >
          {actionError}
        </p>
      )}

      <section className="mb-8">
        <h2 className="mb-2 text-sm font-medium text-gray-300">
          Pending requests{pending.length > 0 ? ` (${pending.length})` : ""}
        </h2>
        {pending.length === 0 ? (
          <p className="rounded-md border border-white/10 px-3 py-4 text-sm text-gray-400">
            Nobody is waiting for access.
          </p>
        ) : (
          <ul className="divide-y divide-white/10 rounded-md border border-white/10">
            {pending.map((request) => (
              <li key={request.id} className="p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <Person
                    name={request.name}
                    email={request.email}
                    avatarUrl={request.avatarUrl}
                    subtitle={
                      <>
                        asked <RelativeTime iso={request.createdAt} />
                      </>
                    }
                  />
                  <span className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void decide(request.id, "approve")}
                      disabled={busyId === request.id}
                      className="inline-flex min-h-9 items-center rounded-md bg-white px-3 text-sm font-medium text-black transition-colors hover:bg-gray-200 disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => void decide(request.id, "reject")}
                      disabled={busyId === request.id}
                      className="inline-flex min-h-9 items-center rounded-md border border-white/20 px-3 text-sm transition-colors hover:bg-white/5 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </span>
                </div>
                {request.message && (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-gray-400">
                    &ldquo;{request.message}&rdquo;
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-sm font-medium text-gray-300">Members</h2>
        <ul className="divide-y divide-white/10 rounded-md border border-white/10">
          {members.map((member) => (
            <li
              key={member.userId}
              className="flex flex-wrap items-center justify-between gap-3 p-3"
            >
              <Person
                name={member.name}
                email={member.email}
                avatarUrl={member.avatarUrl}
                subtitle={
                  <>
                    {member.role === "owner" ? "owner" : "member"} since{" "}
                    <RelativeTime iso={member.createdAt} />
                  </>
                }
              />
              {/* The owner row has no remove control on purpose: the backend
                  refuses to delete it, so a button here could only ever 404. */}
              {member.role === "member" &&
                (confirmRevokeId === member.userId ? (
                  <span className="flex items-center gap-2 text-sm">
                    <span className="text-gray-400">Remove?</span>
                    <button
                      type="button"
                      onClick={() => void revoke(member.userId)}
                      disabled={busyId === member.userId}
                      className="inline-flex min-h-9 items-center rounded-md border border-red-500/40 px-3 text-sm text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                    >
                      Yes, remove
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmRevokeId(null)}
                      className="inline-flex min-h-9 items-center rounded-md px-2 text-sm text-gray-400 transition-colors hover:text-gray-200"
                    >
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmRevokeId(member.userId)}
                    className="inline-flex min-h-9 items-center rounded-md border border-white/20 px-3 text-sm transition-colors hover:bg-white/5"
                  >
                    Remove
                  </button>
                ))}
            </li>
          ))}
        </ul>

        <form
          className="mt-3 flex flex-wrap items-start gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void invite();
          }}
        >
          <label htmlFor="journal-invite-email" className="sr-only">
            Invite by email
          </label>
          <input
            id="journal-invite-email"
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="someone@gmail.com"
            className="min-h-9 flex-1 rounded-md border border-white/15 bg-transparent px-3 text-sm placeholder:text-gray-500 focus:border-white/40 focus:outline-none"
          />
          <button
            type="submit"
            disabled={inviting || !inviteEmail.trim()}
            className="inline-flex min-h-9 items-center rounded-md border border-white/20 px-4 text-sm transition-colors hover:bg-white/5 disabled:opacity-50"
          >
            {inviting ? "Inviting…" : "Invite"}
          </button>
        </form>
        <p className="mt-1.5 text-xs text-gray-400">
          Sign-in is Google-only, so an invitee has to sign in to shanejli.com once before
          their email can be invited.
        </p>
        {inviteError && (
          <p role="alert" className="mt-2 text-sm text-red-400">
            {inviteError}
          </p>
        )}
        {inviteNotice && (
          <p role="status" className="mt-2 text-sm text-emerald-400">
            {inviteNotice}
          </p>
        )}
      </section>

      {decided.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-medium text-gray-300">Already decided</h2>
          <ul className="divide-y divide-white/10 rounded-md border border-white/10">
            {decided.map((request) => (
              <li
                key={request.id}
                className="flex flex-wrap items-center justify-between gap-3 p-3"
              >
                <Person
                  name={request.name}
                  email={request.email}
                  avatarUrl={request.avatarUrl}
                  subtitle={
                    request.decidedAt ? (
                      <>
                        decided <RelativeTime iso={request.decidedAt} />
                      </>
                    ) : (
                      <>
                        asked <RelativeTime iso={request.createdAt} />
                      </>
                    )
                  }
                />
                <span
                  className={
                    request.status === "approved"
                      ? "rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300"
                      : "rounded-full bg-red-500/15 px-2 py-0.5 text-xs text-red-400"
                  }
                >
                  {request.status === "approved" ? "Approved" : "Rejected"}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-xs text-gray-400">
            Rejecting isn&apos;t permanent — if someone asks again, they reappear in the
            pending queue above.
          </p>
        </section>
      )}

      <Link
        href="/journal"
        className="mt-8 inline-block text-sm text-gray-400 hover:text-gray-300"
      >
        &larr; all entries
      </Link>
    </div>
  );
}

/** Avatar + name + email + one line of context, shared by all three lists. */
function Person({
  name,
  email,
  avatarUrl,
  subtitle,
}: {
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  subtitle: React.ReactNode;
}) {
  // The API left-joins users, so a deleted account can leave these null.
  const displayName = name?.trim() || email || "Unknown account";
  return (
    <span className="flex min-w-0 items-center gap-2">
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt=""
          className="h-8 w-8 shrink-0 rounded-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        <span className="h-8 w-8 shrink-0 rounded-full bg-white/10" aria-hidden="true" />
      )}
      <span className="min-w-0">
        <span className="block truncate text-sm text-gray-200">{displayName}</span>
        <span className="block truncate text-xs text-gray-400">
          {email && email !== displayName ? `${email} · ` : ""}
          {subtitle}
        </span>
      </span>
    </span>
  );
}
