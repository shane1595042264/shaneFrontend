"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthGate } from "@/components/auth-gate";
import { createGroup } from "@/lib/api/trip-groups";

export default function NewGroupPage() {
  return (
    <AuthGate>
      <NewGroupForm />
    </AuthGate>
  );
}

function NewGroupForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    setCreating(true);
    setError(null);
    try {
      const res = await createGroup(trimmed);
      router.push(`/trips/groups/${res.slug}`);
    } catch (err) {
      setError((err as Error).message);
      setCreating(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Link href="/trips/groups" className="text-sm text-gray-500 hover:text-gray-300">← back to groups</Link>
      <h1 className="mt-3 mb-6 text-2xl font-semibold">New trip group</h1>

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="group-title" className="mb-1 block text-sm text-gray-400">
            Group title
          </label>
          <input
            id="group-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Tokyo + Kyoto, May 2026"
            maxLength={200}
            required
            className="block min-h-11 w-full rounded border border-white/15 bg-black/30 px-3 py-1.5 text-sm text-white/90 focus:border-white/40 focus:outline-none"
          />
          <p className="mt-1 text-xs text-gray-500">
            Slug is generated from the title. Share the slug with friends so they can join.
          </p>
        </div>

        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="submit"
            disabled={!title.trim() || creating}
            className="inline-flex min-h-11 items-center justify-center rounded bg-white px-4 text-sm font-medium text-black hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {creating ? "Creating…" : "Create group"}
          </button>
          <Link
            href="/trips/groups"
            className="inline-flex min-h-11 items-center justify-center rounded border border-white/20 px-4 text-sm hover:bg-white/5"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
