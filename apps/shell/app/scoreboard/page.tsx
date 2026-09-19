import { ScoreboardBrowser } from "@/components/scoreboard/scoreboard-browser";
import { API_URL } from "@/lib/api-url";
import type { Game, Match, Player } from "@/lib/api/scoreboard";

// SHAN-508: this page used to be one big "use client" component wrapped in a
// <Suspense fallback={null}> (for useSearchParams' prerender bailout), so the
// document it served contained 55 characters of navigation chrome and not one
// game, player or score. The sitemap advertises /scoreboard and robots.txt
// allows it, and every endpoint below is public — GET games/players/matches
// need no auth, only the record-a-match controls do — so there was nothing to
// withhold: the content simply was not in the HTML. Anything that does not run
// JavaScript, crawlers and the AI agents this site courts with /llms.txt, got
// a blank page.
//
// 300s matches /blog, /courses and /vocabulary. The window only affects a cold
// visitor's first paint: the browser still refreshes on mount, so a match
// recorded moments ago is on screen either way.
export const revalidate = 300;

// One page of matches, exactly the size listMatches() asks for. Prod holds 68,
// so today this is the whole set; if it ever overflows, the client's own
// paginating fetch corrects the tally on mount.
const MATCHES_LIMIT = 100;

// Fails soft to null rather than throwing: a backend blip mid-deploy then
// degrades to the original fetch-on-mount path (skeleton, then content, or the
// existing error message) instead of taking the page down.
async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}${path}`, { next: { revalidate } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export default async function ScoreboardPage() {
  const [games, players, matches] = await Promise.all([
    fetchJson<{ games: Game[] }>("/api/scoreboard/games"),
    fetchJson<{ players: Player[] }>("/api/scoreboard/players"),
    fetchJson<{ matches: Match[] }>(
      `/api/scoreboard/matches?limit=${MATCHES_LIMIT}`,
    ),
  ]);

  // All three or none: the hall's tally line reads games and matches together,
  // so a half-seeded render would show games with the wrong scores under them.
  const seeded = games && players && matches;

  return (
    <ScoreboardBrowser
      initialGames={seeded ? games.games : null}
      initialPlayers={seeded ? players.players : null}
      initialMatches={seeded ? matches.matches : null}
    />
  );
}
