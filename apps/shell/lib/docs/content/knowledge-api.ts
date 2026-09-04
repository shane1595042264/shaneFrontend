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
| GET | /entries | public | \`?language=&label=&search=&category=&app=&limit=1..500&offset=\`; returns \`{entries, total, limit, offset}\` (offset pagination, unlike most modules) |
| GET | /entries/:id | public | \`{entry, connections, connectedEntries}\` |
| POST | /entries | knowledge:write | word + language required; 409 \`{error, existingEntry}\` on (word, language, category) duplicate; auto-enriches vocabulary entries via LLM unless \`autoEnrich:false\` (enrich failure never blocks) |
| PUT | /entries/:id | auth only | owner-only (legacy ownerless rows editable by anyone authed); \`memorizationLocations\` feeds the long-term-memorized derivation |
| DELETE | /entries/:id | auth only | same ownership rule |
| POST | /entries/bulk-delete | auth only | \`{ids: [1..100]}\`; always 200 with per-id \`{deleted, denied, notFound}\` |
| POST | /entries/:id/enrich | knowledge:write | re-run AI enrichment; 502 on LLM exhaustion |

Connections (synonym, antonym, related, translation, root): \`GET/POST /connections\`, \`DELETE /connections/:id\`. The knowledge-module versions do NOT check word ownership; the vocabulary-module twins DO (403 unless you own both words). Pick the path matching the permission behavior you want.

Comments: same shape as journal comments (\`GET/POST /entries/:id/comments\`, \`PATCH/DELETE /comments/:id\`, scope \`comments:write\`, snake_case \`parent_comment_id\`, one reply level).

## Vocabulary module differences

Full route table: [Vocabulary API](/docs/vocabulary-api). The differences that bite most often:

- \`GET /api/vocabulary/words\` search matches the word column only; list key is \`{words}\` not \`{entries}\`.
- Duplicate check is (word, language) with no category dimension.
- All writes use scope \`knowledge:write\` (there is no vocabulary:write), bucket \`vocabulary-writes\` 30/min, enrich 10/min.
`;
export default body;
