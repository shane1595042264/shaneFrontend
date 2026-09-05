const body = `# Scoreboard API

The IRL game scoreboard at /scoreboard. Mounted at \`/api/scoreboard\`. Three nouns: **games** (what you play), **players** (who plays), and **matches** (one session of a game, live until you finish it). Shipped 2026-08-25 (SHAN-435).

## Model

- Colors (games and players): \`amber sky emerald fuchsia rose violet lime cyan orange teal\`. Omit \`color\` on create and one is assigned round-robin from the current row count, so a fresh roster comes out visually distinct without you choosing.
- Match \`status\` is \`live\` or \`final\`. A live match has mutable scores; finishing it freezes scoring until you reopen it.
- **The winner is computed, never chosen** (SHAN-446). Finishing a match reads the roster's scores: the single top scorer wins, and two or more players level at the top is a tie. A final match carries \`outcome\` (\`win\` or \`tie\`), \`winnerPlayerId\` (the sole winner, or \`null\` on a tie) and \`winnerPlayerIds\` (one id on a win, every level id on a tie). A live match has \`outcome: null\`, \`winnerPlayerId: null\` and \`winnerPlayerIds: []\`. An untouched 0-0 board is a tie, not a win for whoever was listed first.
- A game's icon is game-icons.net art, stored denormalized as \`{path, viewBox, slug}\` so rendering never depends on GitHub being up. \`slug\` is \`category/name\`, e.g. \`delapouite/chess-king\`.
- Games and players are global (anyone's reads see the same roster), but mutations are owner-scoped to whoever created the row.

## Reads (public)

| Method | Path | Notes |
|---|---|---|
| GET | /games | \`{games, stats}\`, oldest first. \`stats\` is \`[{gameId, playerId, wins}]\` counted over final matches only, so a game nobody has finished is simply absent. Tied matches have no winner and are counted under \`playerId: null\` |
| GET | /players | \`{players}\`, oldest first |
| GET | /matches | \`{matches, nextCursor}\` newest first, each match with an embedded \`players\` array of \`{playerId, name, color, score, position}\` |
| GET | /matches/:id | \`{match}\`, same shape; 404 if unknown |

\`GET /matches\` takes \`gameId\`, \`status\` (\`live\` or \`final\`), \`limit\` (1..100, default 50) and \`cursor\`. **The cursor is an ISO datetime on \`createdAt\`, not a date string** (the journal's date-based cursor does not apply here). Do not build it yourself: page by passing back the \`nextCursor\` the previous response gave you, and stop when it is \`null\`. A full page always carries a \`nextCursor\`, so the last page of an exact multiple of \`limit\` costs one extra empty request -- the same contract as \`GET /api/courses\` and \`GET /api/journal/entries\`.

Aggregate over every page, not just the first. Win tallies computed from a single capped page under-count as soon as the history outgrows it.

## Reads (authed)

| Method | Path | Notes |
|---|---|---|
| GET | /icons/search?q= | \`{results}\` of \`{slug, previewUrl, ...}\`. Requires a token (any scope) because it spends GitHub API quota. \`q\` is 2..60 chars. If GitHub is unreachable on a cold cache it returns \`{results: []}\` rather than an error, so treat an empty list as "try another word", not as failure |

## Writes

Every write needs scope \`entries:write\` and shares PAT bucket \`scoreboard-write\` (60/min); browser JWT sessions bypass the limit. Mutations are owner-scoped and answer **404 \`Not found or not owner\`** rather than 403, so you cannot probe for rows you do not own. Every PATCH requires at least one field.

### Games

| Method | Path | Body | Notes |
|---|---|---|---|
| POST | /games | \`{name, iconSlug, description?, rules?, color?}\` | name <=120, description/rules <=4000. The icon art is fetched server-side at create time; an unreachable or unknown \`iconSlug\` is a **502**, not a 400 |
| PATCH | /games/:id | any of name, description, rules, iconSlug, color | passing \`iconSlug\` re-fetches the art, same 502 on failure |
| DELETE | /games/:id | none | 204. **Cascades: every match of that game is deleted with it**, silently and with no 409 guard, unlike player deletion below |

### Players

| Method | Path | Body | Notes |
|---|---|---|---|
| POST | /players | \`{name, color?}\` | name <=80 |
| PATCH | /players/:id | \`{name?, color?}\` | |
| DELETE | /players/:id | none | 204, but **409** if the player appears in any match. Delete those matches first |

### Matches

| Method | Path | Body | Notes |
|---|---|---|---|
| POST | /matches | \`{gameId, playerIds, location?}\` | 2..8 player ids, must be unique (400 on duplicates) and must all exist (400 \`Unknown player id\`). Scores start at 0 |
| PATCH | /matches/:id | \`{location}\` | the only editable match field, and the only edit still allowed on a final match (where the game happened is a record, not a score) |
| PATCH | /matches/:id/score | \`{playerId, delta}\` | \`delta\` is exactly \`1\` or \`-1\`; anything else fails validation. **409** if the match is already final, **404** if the player is not in this match |
| POST | /matches/:id/finish | none | the winner is derived from the scores, so there is nothing to send; a body is accepted but ignored. **409** if the match is already final, **404** if you do not own it |
| POST | /matches/:id/reopen | none | back to \`live\` and scores become mutable again; **409** if the match is not final |
| DELETE | /matches/:id | none | 204, removes its participant rows too |

## Example

Record one match end to end:

\`\`\`bash
API=https://shanebackend-production.up.railway.app/api/scoreboard

# 1. create a game (icon art is fetched server-side, so this can take a second)
curl -X POST $API/games -H "Authorization: Bearer $PAT" -H "Content-Type: application/json" \\
  -d '{"name":"Catan","iconSlug":"delapouite/chess-king","rules":"First to 10 points"}'

# 2. two players, then a live match between them
curl -X POST $API/players -H "Authorization: Bearer $PAT" -H "Content-Type: application/json" -d '{"name":"Shane"}'
curl -X POST $API/matches -H "Authorization: Bearer $PAT" -H "Content-Type: application/json" \\
  -d '{"gameId":"<GAME_ID>","playerIds":["<P1>","<P2>"],"location":"Dallas"}'

# 3. score, then freeze it
curl -X PATCH $API/matches/<MATCH_ID>/score -H "Authorization: Bearer $PAT" -H "Content-Type: application/json" \\
  -d '{"playerId":"<P1>","delta":1}'
curl -X POST $API/matches/<MATCH_ID>/finish -H "Authorization: Bearer $PAT"
# -> {"match": {..., "outcome": "win", "winnerPlayerId": "<P1>", "winnerPlayerIds": ["<P1>"]}}
\`\`\`

Once finished, the match counts toward \`stats\` on \`GET /games\`. Further \`/score\` calls answer 409 until you \`POST /matches/:id/reopen\`, which clears the outcome and makes the scores mutable again -- that is how you correct a match that finished on the wrong scoreline.
`;
export default body;
