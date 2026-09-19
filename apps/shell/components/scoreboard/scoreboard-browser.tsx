"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useHydrated } from "@/lib/use-hydrated";
import {
  listGames,
  listMatches,
  listPlayers,
  type Game,
  type Match,
  type Player,
} from "@/lib/api/scoreboard";
import { Hall } from "@/components/scoreboard/hall";
import { Cabinet } from "@/components/scoreboard/cabinet";
import { LiveMatch } from "@/components/scoreboard/live-match";

/**
 * SHAN-508: the interactive half of /scoreboard, seeded by the server
 * component above it so the hall is in the HTML document.
 *
 * `?game=` is read from `window.location` and written with the native history
 * API rather than through `useSearchParams()`/`router.replace()`, for the same
 * reason blog-index.tsx (SHAN-493), courses/catalog.tsx (SHAN-498) and
 * knowledge/page.tsx (SHAN-499) do: `useSearchParams()` in a client component
 * forces the nearest Suspense boundary to render its fallback during
 * prerender, which is what was erasing this page's server output. The native
 * API leaves the prerender alone. `replaceState` keeps the old
 * `router.replace(..., { scroll: false })` behaviour of not stacking a history
 * entry per cabinet.
 */
function readGameId(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("game");
}

function writeGameId(id: string | null) {
  const params = new URLSearchParams(window.location.search);
  if (id) params.set("game", id);
  else params.delete("game");
  const qs = params.toString();
  const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
  if (url === `${window.location.pathname}${window.location.search}`) return;
  window.history.replaceState(null, "", url);
}

export function ScoreboardBrowser({
  initialGames,
  initialPlayers,
  initialMatches,
}: {
  initialGames: Game[] | null;
  initialPlayers: Player[] | null;
  initialMatches: Match[] | null;
}) {
  const { user: authUser } = useAuth();
  const hydrated = useHydrated();
  // SHAN-492: the admin controls are server-rendered absent because the server
  // cannot know who is asking. Gating on `useAuth().user` alone would render
  // them during this component's hydration pass and throw React #418.
  const isAdmin = hydrated && !!authUser;

  const seeded = initialGames !== null;
  const [games, setGames] = useState<Game[]>(initialGames ?? []);
  const [players, setPlayers] = useState<Player[]>(initialPlayers ?? []);
  const [matches, setMatches] = useState<Match[]>(initialMatches ?? []);
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
  const [loading, setLoading] = useState(!seeded);
  const [error, setError] = useState<string | null>(null);

  // Not seeded from the URL: the server has no query string, so the first
  // client render has to be the hall for the markup to match. A deep link
  // therefore paints the hall for one frame before its cabinet, which is no
  // worse than the skeleton this page used to show first.
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  useEffect(() => {
    setSelectedGameId(readGameId());
    const onPopState = () => {
      setActiveMatchId(null);
      setSelectedGameId(readGameId());
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [g, p, m] = await Promise.all([
        listGames(),
        listPlayers(),
        listMatches(),
      ]);
      setGames(g.games);
      setPlayers(p);
      setMatches(m);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load the scoreboard");
    }
  }, []);

  // Still refetches on mount even when seeded: the seed can be up to
  // `revalidate` seconds old and a live match's score moves faster than that.
  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const onSelectGame = useCallback((id: string | null) => {
    setActiveMatchId(null);
    setSelectedGameId(id);
    writeGameId(id);
  }, []);

  const selectedGame = games.find((g) => g.id === selectedGameId) ?? null;
  const activeMatch = matches.find((m) => m.id === activeMatchId) ?? null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <header className="mb-8 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Supermassive Scoreboard
          </h1>
          <p className="mt-2 text-sm text-gray-400">
            Friendly competitions, recorded for posterity.
          </p>
        </div>
        <Link href="/" className="text-sm text-gray-400 hover:text-gray-300">
          &larr; Home
        </Link>
      </header>

      {error && (
        <p role="alert" className="mb-4 text-sm text-red-400">
          {error}
        </p>
      )}

      {loading ? (
        <div
          role="status"
          aria-label="Loading scoreboard"
          className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
        >
          <span className="sr-only">Loading scoreboard</span>
          {Array.from({ length: 4 }, (_, i) => (
            <div
              key={i}
              className="h-48 rounded-lg border border-white/10 bg-black/20 animate-pulse"
            />
          ))}
        </div>
      ) : activeMatch ? (
        <LiveMatch
          match={activeMatch}
          game={games.find((g) => g.id === activeMatch.gameId) ?? null}
          isAdmin={isAdmin}
          refresh={refresh}
          onExit={() => setActiveMatchId(null)}
        />
      ) : selectedGame ? (
        <Cabinet
          game={selectedGame}
          players={players}
          matches={matches.filter((m) => m.gameId === selectedGame.id)}
          isAdmin={isAdmin}
          refresh={refresh}
          onBack={() => onSelectGame(null)}
          onOpenMatch={setActiveMatchId}
        />
      ) : (
        <Hall
          games={games}
          players={players}
          matches={matches}
          isAdmin={isAdmin}
          refresh={refresh}
          onSelectGame={onSelectGame}
          onOpenMatch={setActiveMatchId}
        />
      )}

      <footer className="mt-16 border-t border-white/10 pt-4 text-xs text-gray-400">
        Game art by{" "}
        <a
          href="https://game-icons.net"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-gray-200"
        >
          game-icons.net
        </a>{" "}
        contributors (CC BY 3.0).
      </footer>
    </div>
  );
}
