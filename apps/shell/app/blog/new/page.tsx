"use client";

import { useEffect, useState } from "react";
import Link from "@/components/transition-link";
import { AuthorOnly } from "@/components/blog/author-only";
import { PostEditor } from "@/components/blog/post-editor";
import { getEntry } from "@/lib/api/journal";
import { draftFromEntry } from "@/lib/journal-to-blog";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

type Prefill = NonNullable<Parameters<typeof PostEditor>[0]["prefill"]>;

type Source =
  | { kind: "none" }
  | { kind: "loading"; date: string }
  | { kind: "ready"; prefill: Prefill }
  | { kind: "error"; date: string; message: string };

// Client-rendered on purpose: the compose form is auth-gated, and a Server
// Component cannot see the JWT (it lives in localStorage), so any server-side
// read of an authed endpoint would 401 on every request.
//
// SHAN-705: /blog/new?from=<date> starts the draft from that journal entry
// ("Publish to blog" on the entry). Read from location in an effect rather
// than useSearchParams, so the page needs no Suspense boundary.
export default function NewBlogPostPage() {
  const [source, setSource] = useState<Source>({ kind: "none" });

  useEffect(() => {
    const from = new URLSearchParams(window.location.search).get("from");
    if (!from || !DATE.test(from)) return;
    setSource({ kind: "loading", date: from });
    getEntry(from)
      .then((detail) => {
        if (!detail) {
          setSource({ kind: "error", date: from, message: "There is no journal entry on that date." });
          return;
        }
        const { title, content } = draftFromEntry(detail);
        setSource({
          kind: "ready",
          prefill: {
            title,
            content,
            status: "draft",
            note: `Started from your journal entry for ${from}. This is a copy: editing it never changes the journal, and nothing is public until you publish it. Check it for anything you meant to keep private.`,
          },
        });
      })
      .catch(() =>
        setSource({
          kind: "error",
          date: from,
          message: "Couldn't load that journal entry. You may not have journal access on this account.",
        })
      );
  }, []);

  return (
    <AuthorOnly>
      {source.kind === "loading" ? (
        <div className="mx-auto max-w-5xl px-4 py-8" aria-busy="true">
          <span className="sr-only">Loading the journal entry</span>
          <div className="h-4 w-28 animate-pulse rounded bg-white/[0.06]" />
          <div className="mt-4 h-8 w-48 animate-pulse rounded bg-white/[0.06]" />
          <div className="mt-6 h-11 w-full animate-pulse rounded-md bg-white/[0.06]" />
          <div className="mt-4 h-72 w-full animate-pulse rounded-md bg-white/[0.04]" />
        </div>
      ) : source.kind === "error" ? (
        <div className="mx-auto max-w-5xl px-4 py-8">
          <p role="alert" className="text-sm text-red-300">
            {source.message}
          </p>
          <div className="mt-4 flex gap-4 text-sm">
            <Link href={`/journal/${source.date}`} className="text-gray-300 hover:text-white">
              Back to the entry
            </Link>
            <Link href="/blog/new" className="text-gray-300 hover:text-white">
              Start a blank post
            </Link>
          </div>
        </div>
      ) : (
        <PostEditor
          // A new key once the entry arrives, so the form starts from it.
          key={source.kind}
          existing={null}
          prefill={source.kind === "ready" ? source.prefill : undefined}
        />
      )}
    </AuthorOnly>
  );
}
