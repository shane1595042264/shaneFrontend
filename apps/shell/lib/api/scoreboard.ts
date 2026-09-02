import { getAuthHeaders } from "@/lib/auth-api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export interface GameIconData {
  path: string;
  viewBox: string;
  slug: string;
}

export interface Game {
  id: string;
  name: string;
  description: string | null;
  rules: string | null;
  icon: GameIconData;
  color: string;
  createdAt: string;
  updatedAt: string;
}

/** Final-match win count for one (game, player) pair. */
export interface GameStat {
  gameId: string;
  playerId: string | null;
  wins: number;
}

export interface Player {
  id: string;
  name: string;
  color: string;
  createdAt: string;
}

export interface MatchPlayer {
  playerId: string;
  name: string;
  color: string;
  score: number;
  position: number;
}

export interface Match {
  id: string;
  gameId: string;
  location: string | null;
  status: "live" | "final";
  winnerPlayerId: string | null;
  playedAt: string;
  createdAt: string;
  players: MatchPlayer[];
}

export interface IconCandidate {
  slug: string;
  previewUrl: string;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...getAuthHeaders(),
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `${res.status}`);
  }
  // DELETE returns 204 with no body.
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const listGames = () =>
  api<{ games: Game[]; stats: GameStat[] }>("/api/scoreboard/games");

export const listPlayers = () =>
  api<{ players: Player[] }>("/api/scoreboard/players").then((r) => r.players);

export const listMatches = (opts?: {
  gameId?: string;
  status?: "live" | "final";
  limit?: number;
}) => {
  const params = new URLSearchParams();
  if (opts?.gameId) params.set("gameId", opts.gameId);
  if (opts?.status) params.set("status", opts.status);
  if (opts?.limit) params.set("limit", String(opts.limit));
  const qs = params.toString();
  return api<{ matches: Match[] }>(
    `/api/scoreboard/matches${qs ? `?${qs}` : ""}`,
  ).then((r) => r.matches);
};

/** Icon typeahead. Returns [] on any failure so the form degrades gracefully. */
export async function searchIcons(
  q: string,
  signal?: AbortSignal,
): Promise<IconCandidate[]> {
  const query = q.trim();
  if (query.length < 2) return [];
  try {
    const res = await fetch(
      `${API_URL}/api/scoreboard/icons/search?q=${encodeURIComponent(query)}`,
      { headers: { ...getAuthHeaders() }, signal },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { results?: IconCandidate[] };
    return data.results ?? [];
  } catch {
    // Aborted (superseded keystroke) or network error: no suggestions.
    return [];
  }
}

export const createGame = (input: {
  name: string;
  description?: string | null;
  rules?: string | null;
  iconSlug: string;
  color?: string;
}) =>
  api<{ game: Game }>("/api/scoreboard/games", {
    method: "POST",
    body: JSON.stringify(input),
  }).then((r) => r.game);

export const updateGame = (
  id: string,
  patch: Partial<{
    name: string;
    description: string | null;
    rules: string | null;
    iconSlug: string;
    color: string;
  }>,
) =>
  api<{ game: Game }>(`/api/scoreboard/games/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  }).then((r) => r.game);

export const deleteGame = (id: string) =>
  api<void>(`/api/scoreboard/games/${id}`, { method: "DELETE" });

export const createPlayer = (input: { name: string; color?: string }) =>
  api<{ player: Player }>("/api/scoreboard/players", {
    method: "POST",
    body: JSON.stringify(input),
  }).then((r) => r.player);

export const updatePlayer = (
  id: string,
  patch: Partial<{ name: string; color: string }>,
) =>
  api<{ player: Player }>(`/api/scoreboard/players/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  }).then((r) => r.player);

export const deletePlayer = (id: string) =>
  api<void>(`/api/scoreboard/players/${id}`, { method: "DELETE" });

export const createMatch = (input: {
  gameId: string;
  playerIds: string[];
  location?: string | null;
}) =>
  api<{ match: Match }>("/api/scoreboard/matches", {
    method: "POST",
    body: JSON.stringify(input),
  }).then((r) => r.match);

/** Edit a recorded match. `location: null` clears the address. */
export const updateMatch = (id: string, patch: { location?: string | null }) =>
  api<{ match: Match }>(`/api/scoreboard/matches/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  }).then((r) => r.match);

export const scoreMatch = (id: string, playerId: string, delta: 1 | -1) =>
  api<{ match: Match }>(`/api/scoreboard/matches/${id}/score`, {
    method: "PATCH",
    body: JSON.stringify({ playerId, delta }),
  }).then((r) => r.match);

export const finishMatch = (id: string, winnerPlayerId: string) =>
  api<{ match: Match }>(`/api/scoreboard/matches/${id}/finish`, {
    method: "POST",
    body: JSON.stringify({ winnerPlayerId }),
  }).then((r) => r.match);

export const reopenMatch = (id: string) =>
  api<{ match: Match }>(`/api/scoreboard/matches/${id}/reopen`, {
    method: "POST",
  }).then((r) => r.match);

export const deleteMatch = (id: string) =>
  api<void>(`/api/scoreboard/matches/${id}`, { method: "DELETE" });
