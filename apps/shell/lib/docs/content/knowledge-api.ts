const body = `# Knowledge API

Free-text note ingest with AI classification, plus structured entries, connections, and comments. Mounted at \`/api/knowledge\`. The vocabulary module (\`/api/vocabulary\`) writes the same underlying table with a narrower surface.

## Note ingest (the interesting endpoint)

\`POST /api/knowledge/notes\` with scope \`knowledge:write\`. Three accepted body shapes (strict: unknown keys are 400):

\`\`\`json
{"text": "today I learned gracias means thank you in Spanish"}
{"text": "...", "source": "Nibbler"}
{"notes": [{"text": "...", "source": {"book": "War and Peace", "location": "ch. 3"}}]}
\`\`\`

- \`text\` trimmed 1..5000. \`source\` is a string (becomes \`{app}\`) or an object with app/book/author/location/rawContext.
- Single: 201 \`{entries:[entry]}\`. Batch (1..50): 201 all-ok, **207** \`{entries, failures:[{index, text, error}]}\` on partial failure, **502** when every note failed or the LLM chain is exhausted (retryable).
- Caller-supplied source fields beat classifier-extracted ones. No cross-request dedup by design; within one batch, duplicate (word, language) pairs are silently dropped.
- Rate: 30/min single, 5/min batch (separate buckets).

## Entries

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | /entries | public | \`?language=&label=&search=&category=&app=&location=&excludeLocation=&limit=1..500&offset=0..1000000\`; returns \`{entries, total, limit, offset}\` (offset pagination, unlike most modules) |
| GET | /entries/:id | public | \`{entry, connections, connectedEntries}\` |
| POST | /entries | knowledge:write | word + language required; 409 \`{error, existingEntry}\` on (word, language, category) duplicate; auto-enriches vocabulary entries via LLM unless \`autoEnrich:false\` (enrich failure never blocks) |
| PUT | /entries/:id | knowledge:write | owner-only (legacy ownerless rows editable by anyone authed); \`memorizationLocations\` replaces the whole list; \`addMemorizationLocations\` / \`removeMemorizationLocations\` change it in place (sending both shapes is a 400); either feeds the long-term-memorized derivation |
| DELETE | /entries/:id | knowledge:write | same ownership rule |
| POST | /entries/bulk-delete | knowledge:write | \`{ids: [1..100]}\`; always 200 with per-id \`{deleted, denied, notFound}\` |
| POST | /entries/:id/enrich | knowledge:write | re-run AI enrichment; 403 on an entry someone else created (same rule as PUT); writes only the fields enrichment returned, so blank fields keep their stored value; 502 on LLM exhaustion |

\`?location=\` matches cards whose \`memorizationLocations\` array contains that place, case-insensitively (max 120 chars, same bound as a single location on PUT). \`?excludeLocation=\` is the inverse with the same bounds: cards NOT yet memorized at that place, including cards with no locations at all, so a place nothing has been memorized at returns every card. \`GET /api/knowledge/locations\` (public) returns \`{locations: string[]}\`: every distinct location across all cards, deduped case-insensitively and sorted. That list is what the browse filter's dropdown is built from. Its siblings \`GET /labels\`, \`GET /languages\` and \`GET /categories\` return the same shape for their dimensions.

To mark or unmark a place, send \`addMemorizationLocations\` or \`removeMemorizationLocations\` (each up to 50 names of up to 120 chars) rather than a full \`memorizationLocations\` list. The deltas are applied to the card as it is stored at that moment, under a row lock that practice mode also takes when it records a newly memorized place, so a place recorded after you read the card is kept. Removal is case-insensitive and adding a place the card already holds, in any casing, changes nothing. A full list overwrites whatever is stored, so only send it when you mean to replace the set.

## Recite

Recite your own cards from memory, one place at a time. Both routes need scope \`knowledge:write\` and work on the caller's cards: ones they created, plus legacy rows with no recorded creator (the same set \`PUT /entries/:id\` lets them write).

| Method | Path | Notes |
|---|---|---|
| POST | /recite/deck | \`{location: 1..120, categories?: string[] (max 50)}\`, strict. Saves the place to your practice locations (\`GET /api/practice/locations\`; a new name creates it, an existing one in any casing reuses it). Returns \`{location: {id, name}, cards, total, categories: [{category, total, remaining}]}\`: your cards that have a definition and are not yet memorized at that place, in random order (max 500), plus per-category counts of all your cards. \`categories\` filters \`cards\` only; the counts always cover every category |
| POST | /entries/:id/recite | \`{location, answer: 1..5000, attempt?: 1..50 (default 1)}\`, strict. Grades \`answer\` against the card's definition for meaning, not wording. Pass: 200 \`{correct: true, score, feedback, judge, memorizedAt, entry}\`, and \`location\` is added to the card's \`memorizationLocations\` under its saved name. Miss: 200 \`{correct: false, score, feedback, judge, hint, hintNumber, hintsTotal}\`, nothing written. 403 on someone else's card, 404 unknown, 422 when the card has no definition, 503 when no grader is reachable |

- \`judge\` says what decided: \`match\` (near-verbatim, no model call), \`ai\` (a small free model; Groq \`gpt-oss-20b\` first) or \`similarity\` (local embeddings, used only when every model provider is down).
- \`hint\` is \`{kind, label, text}\`; send the attempt number and attempt N gets hint N, gentlest first: \`example\` (or \`topics\` when the card has no example, or its example contains the answer), \`opening\` (the first few words, skipped for answers under four words), then \`shape\` (each word's first letter, the rest masked). Past the last hint, the last one repeats.
- Miss \`feedback\` never names what is missing. Feedback that would is replaced server-side; the hints are the only part of a miss that reveals the answer.
- Rate (PATs): 30/min deck, 60/min attempts.

Connections (synonym, antonym, related, translation, root): \`GET/POST /connections\`, \`DELETE /connections/:id\`, scope \`knowledge:write\`. POST returns 201 \`{connection}\`; 400 connecting an entry to itself, 404 unknown entry id, **403 unless you own both entries**, 409 if that typed edge already exists. DELETE returns \`{ok: true}\`; 404 unknown, 403 unless you own both endpoint entries. Entries with no recorded creator (legacy rows) count as yours for this check. Both modules enforce the same rule on the same table, so neither path can link or unlink someone else's entries.

Comments: same shape as journal comments (\`GET/POST /entries/:id/comments\`, \`PATCH/DELETE /comments/:id\`, scope \`comments:write\`, snake_case \`parent_comment_id\`, one reply level). The parent must be a top-level comment on the same entry, or the POST is a 400; deleting a comment keeps its replies as top-level comments.

## Vocabulary module differences

Full route table: [Vocabulary API](/docs/vocabulary-api). The differences that bite most often:

- \`GET /api/vocabulary/words\` search matches the word column only; list key is \`{words}\` not \`{entries}\`. Both modules match \`search\` literally -- do not escape \`%\` or \`_\` yourself, see [Text search](/docs/conventions#text-search).
- Duplicate check is (word, language) with no category dimension.
- All writes use scope \`knowledge:write\` (there is no vocabulary:write), bucket \`vocabulary-writes\` 30/min, enrich 10/min.
`;
export default body;
