const body = `# Elements Directory

Every element on the periodic table, its route, backend mount, and auth model, in one table. "Public reads" means unauthenticated GETs; writes always need a token unless noted.

| Element | Route | Backend mount | Auth model | What it is |
|---|---|---|---|---|
| Journal | /journal | /api/journal | public reads; scoped writes | collaborative wiki-journal, see [Journal API](/docs/journal-api) |
| Documentation | /docs | (frontend only) | fully public | these docs; /llms.txt, /llms-full.txt |
| Blitz | blitz.shanejli.com (external, new tab) | /api/blitz (sync session) + sync.shanejli.com (SuperSync, its own service) | Sign in with Google inside Blitz; browser JWT only, no PAT access | self-hosted Super Productivity fork: tasks, Pomodoro, planner, cross-device sync; see [Auth and Tokens](/docs/auth) |
| Courses | /courses | /api/courses | public reads; scoped writes | AI-classified course catalog, see [Courses API](/docs/courses-api) |
| Trips | /trips | /api/trips | public reads AND anonymous create | trip itinerary pastebin, see [Trips API](/docs/trips-api) |
| Knowledge | /knowledge | /api/knowledge | public reads; scoped writes | AI-classified knowledge base, see [Knowledge API](/docs/knowledge-api) |
| Vocabulary | /vocabulary | /api/vocabulary | public reads; knowledge:write writes | narrower view of the same data |
| Scoreboard | /scoreboard | /api/scoreboard | public reads; entries:write writes | IRL game scoreboard, see [Scoreboard API](/docs/scoreboard-api) |
| Tea | /journal/tea | /api/tea-entries | authed author; PIN-gated shares | private entries unlocked per-entry via the X-Tea-Pin header |
| Skincare | /skincare | /api/skincare | authed only, owner-scoped | AM/PM routine tracker |
| Practice | /practice | /api/practice | authed, practice:write writes | training sessions + vocab SRS |
| RNG Capitalist | /rng-capitalist | /api/rng | authed (any PAT), no scope | AI purchase-decision roulette; evaluate costs an LLM call, 10/min |
| Who Owes Me | /who-owes-me | /api/loans | authed, no scope | personal loan ledger; non-owner mutations 403 |
| Slot assignments | (homepage) | /api/slot-assignments | authed | periodic-table layout persistence; PUT replaces the whole map |
| Activities | (journal sidebar) | /api/activities/:date | public read only | daily activity feed; ingest is cron/admin only |

## Cross-element gotchas

- Tea PIN flow: GET /api/tea-entries/:id returns 401 \`PIN required\` without a valid 4-digit \`X-Tea-Pin\` header, 403 on a wrong PIN, 429 after 10 failures per entry per minute. Distinguish the three.
- Skincare reorder is \`POST /api/skincare/reorder\` (declared before /:id) and requires the COMPLETE ordered id list for that routine.
- Scoreboard \`GET /icons/search\` requires auth because it spends GitHub API quota; deleting a player with match history is a 409.
- RNG evaluate auto-bans a denied category for 30 days; there is no unban endpoint.
- Admin-gated or machine-only surfaces (practice settings PATCH, activity ingest, wechat ingest, calendar connect) are not usable with PATs; skip them.
`;
export default body;
