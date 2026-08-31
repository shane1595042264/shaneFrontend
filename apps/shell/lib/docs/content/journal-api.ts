const body = `# Journal API

The collaborative wiki-journal at /journal. Mounted at \`/api/journal\`. Verified against production 2026-08-31.

## Semantics you must know first

- One entry per calendar date, site-wide. The first poster becomes the permanent author.
- Entry bodies are append-only. There is NO edit endpoint for anyone, author included; \`PATCH /entries/:date\` always returns 405. Content changes only via appends, approved suggestions, or revert.
- Authors append; non-authors suggest. An author gets 403 trying to suggest on their own entry, a non-author gets 403 trying to append.
- Trashing an entry (\`DELETE /entries/:date\`, author only, soft) has no undo and the date still 409s on re-create. Do not create test entries on dates you care about.
- Appends and versions are immutable forever. Comments are the only hard delete.

## Quickstart

\`\`\`bash
B=https://shanebackend-production.up.railway.app
# needs scope entries:write
curl -X POST $B/api/journal/entries \\
  -H "Authorization: Bearer $PAT" -H "Content-Type: application/json" \\
  -d '{"date":"2026-09-01","content":"# Title\\n\\nGFM markdown body..."}'
# 201 {entry, currentVersionNum: 1} | 409 date taken
\`\`\`

## Endpoints

Reads (public):

| Method | Path | Notes |
|---|---|---|
| GET | /entries | \`?limit=1..100&cursor=YYYY-MM-DD&from=&to=&q=\`; \`q\` is case-insensitive substring over body and appends; returns \`{entries, nextCursor}\` |
| GET | /entries/:date | \`{entry, author, content, currentVersionNum, appends}\`; the If-Match seed |
| GET | /entries/:date/versions | full content per version |
| GET | /entries/:date/versions/:num | one version |
| GET | /entries/:date/appends | append timeline |
| GET | /entries/:date/neighbors | \`{prev, next}\` published dates |
| GET | /entries/:date/suggestions | \`?status=pending\\|approved\\|rejected\\|withdrawn\` |
| GET | /suggestions/:id | one suggestion |
| GET | /entries/:date/comments | with author objects |
| GET | /entries/:date/reactions | \`{summary, mine}\` |
| GET | /comments/:id/reactions | \`{summary, mine}\` |

Writes:

| Method | Path | Scope | Body | Key errors |
|---|---|---|---|---|
| POST | /entries | entries:write | \`{date, content}\` (content trimmed 1..100k) | 409 date taken |
| POST | /entries/:date/appends | entries:write | \`{content}\` 1..100k | 403 not author |
| POST | /entries/:date/revert | entries:write + If-Match | \`{target_version_num}\` | 428/400/409 If-Match; 403 not author; nonexistent target currently 500s, check /versions first |
| DELETE | /entries/:date | entries:write | none | 404 not author; irreversible |
| POST | /entries/:date/suggestions | suggestions:write | \`{base_version_num, proposed_content}\` (full replacement, no diff format) | 403 if you are the author |
| PATCH | /suggestions/:id/approve | suggestions:write + If-Match | none | 403 not entry author; non-pending currently 500s |
| PATCH | /suggestions/:id/reject | suggestions:write | \`{reason?}\` max 2000 | 403 not entry author; non-pending currently 500s |
| PATCH | /suggestions/:id/withdraw | suggestions:write | none | proposer + pending only; all failures are 403 |
| GET | /inbox | auth only | none | pending suggestions on entries you author |
| POST | /entries/:date/comments | comments:write | \`{content, parent_comment_id?}\` 1..10k | one reply level renders |
| PATCH | /comments/:id | comments:write | \`{content}\` | author only |
| DELETE | /comments/:id | comments:write | none | comment author or entry author; 204 |
| POST | /entries/:date/reactions | reactions:write | \`{emoji}\` | toggle; shortcodes only |
| POST | /comments/:id/reactions | reactions:write | \`{emoji}\` | toggle |

Reaction shortcode allowlist: \`+1 -1 laugh heart hooray rocket eyes confused\` (raw unicode is 400 Invalid emoji).

## Content rules

- Markdown is CommonMark + GFM (tables, task lists, strikethrough, autolinks, footnotes, fenced code with language tag but no highlighting).
- Raw HTML is silently stripped. No math rendering.
- Fenced \`\`\`mermaid blocks render as diagrams in entry bodies and appends (client-side; SSR, feeds, and comments show the raw code; invalid mermaid falls back to the code block with an error note). For other diagram tools see [Images API](/docs/images-api).
- Bodies containing an in-flight editor upload placeholder (\`uploading-...\` image token) are 400.

## Freshness

The API reflects writes instantly. Site pages are ISR-cached: a brand-new date page appears immediately, the /journal index and already-cached pages lag up to ~5 minutes, feeds and OG images up to 1 hour. There is no revalidation hook.
`;
export default body;
