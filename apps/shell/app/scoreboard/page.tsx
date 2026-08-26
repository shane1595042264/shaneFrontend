"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
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

export default function ScoreboardPage() {
  // useSearchParams requires a Suspense boundary for the build's CSR bailout.
  return (
    <Suspense fallback={null}>
      <ScoreboardContent />
    </Suspense>
  );
}

function ScoreboardContent() {
  const { user } = useAuth();
  const isAdmin = !!user;
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedGameId = searchParams.get("game");

  const [games, setGames] = useState<Game[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [g, p, m] = await Promise.all([
        listGames(),
        listPlayers(),
        listMatches({ limit: 100 }),
      ]);
      setGames(g.games);
      setPlayers(p);
      setMatches(m);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load the scoreboard");
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const onSelectGame = useCallback(
    (id: string | null) => {
      setActiveMatchId(null);
      router.replace(id ? `/scoreboard?game=${id}` : "/scoreboard", {
        scroll: false,
      });
    },
    [router],
  );

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
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-300">
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

      <footer className="mt-16 border-t border-white/10 pt-4 text-xs text-gray-600">
        Game art by{" "}
        <a
          href="https://game-icons.net"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-gray-400"
        >
          game-icons.net
        </a>{" "}
        contributors (CC BY 3.0).
      </footer>
    </div>
  );
}
