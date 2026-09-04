const body = `# Vocabulary API

The word list at /vocabulary. Mounted at \`/api/vocabulary\`. Two nouns: **words** and **connections** (typed edges between two words).

This module writes the same \`vocab_words\` table as the [Knowledge API](/docs/knowledge-api), so a word created either way is visible from both. The surface here is narrower and several response keys differ, so pick one path per client and stay on it rather than mixing them.

## Model

- A word reads back as \`{id, word, language, category, definition, pronunciation, partOfSpeech, exampleSentence, labels, aiMetadata, source, memorizationLocations, longTermMemorized, createdBy, createdAt, updatedAt}\`.
- \`category\`, \`source\`, \`memorizationLocations\` and \`longTermMemorized\` come back on every read but **cannot be set through this module**: they belong to the knowledge ingest and practice paths. Through \`/api/vocabulary\` they stay at their defaults.
- \`language\` is free text (\`spanish\`, \`korean\`, \`python\`), not a locale code, and \`labels\` is a flat string array. Both are open vocabularies: read the live sets from \`GET /languages\` and \`GET /labels\` instead of hardcoding.
- **Creating a word runs an LLM enrichment pass** that fills definition, pronunciation, partOfSpeech, exampleSentence and labels. Fields you send explicitly always beat enriched ones, and \`autoEnrich: false\` skips the pass entirely. Enrichment failure never blocks the write, so the word is created unenriched and the error is only logged.
- A connection is typed: \`synonym antonym related translation root\`. Uniqueness is on (fromWordId, toWordId, connectionType), so the same pair can carry several differently-typed edges but not two of the same type.

## Reads (public)

| Method | Path | Notes |
|---|---|---|
| GET | /words | \`{words, total, limit, offset}\`, newest first. **Offset pagination, not a cursor**, unlike the journal and scoreboard |
| GET | /words/:id | \`{word, connections, connectedWords}\`; **404** \`Word not found\`. The key is \`connectedWords\`; the knowledge twin returns \`connectedEntries\` |
| GET | /connections | \`?wordId=<uuid>\` is required (400 without it); \`{connections}\` covering edges in both directions |
| GET | /labels | \`{labels}\`, every distinct label across all words, sorted |
| GET | /languages | \`{languages}\`, every distinct language, sorted |

\`GET /words\` filters: \`language\` exact match, \`label\` exact match against the array (containment, not substring), \`search\` case-insensitive substring **on the word column only** (definitions and examples are not searched), \`limit\` 1..500 default 100, \`offset\` >= 0 default 0. Oversized filter values are rejected with a 400 before touching the database.

## Writes

Every write needs scope \`knowledge:write\`. **There is no \`vocabulary:write\`**. Plain CRUD shares PAT bucket \`vocabulary-writes\` (30/min); enrichment gets its own tighter bucket \`vocabulary-enrich\` (10/min) because each call spends an LLM request. Browser JWT sessions bypass both.

Ownership: you may modify only words you created. Legacy rows with no creator (\`createdBy: null\`, predating the column) stay writable by any authed caller. A violation answers **403**, not the 404 that owner-scoped modules like the scoreboard use, so this path does tell you the row exists.

### Words

| Method | Path | Body | Notes |
|---|---|---|---|
| POST | /words | \`{word, language, definition?, pronunciation?, partOfSpeech?, exampleSentence?, labels?, autoEnrich?}\` | 201 \`{word}\`. **409 \`{error, existingWord}\`** when (word, language) already exists. A two-part key, unlike the knowledge module's (word, language, category). Caps: word 255, language 50, definition 20000, pronunciation 255, partOfSpeech 50, exampleSentence 2000, labels 50 entries of 100 |
| PUT | /words/:id | same fields, all optional, no \`autoEnrich\` | **Despite the PUT verb this is a partial update**: only the keys you send change; omitted fields are left alone. 404 unknown, 403 not yours |
| DELETE | /words/:id | none | \`{ok: true}\`. **Cascades: the word's connections are deleted with it**, with no 409 guard. 404/403 as above |
| POST | /words/:id/enrich | none | re-runs the LLM pass over the stored word and language. Each field is overwritten only when enrichment returns something for it, so a blank result keeps the old value. **502** (retryable) when every LLM provider is exhausted, 500 on anything else |

### Connections

| Method | Path | Body | Notes |
|---|---|---|---|
| POST | /connections | \`{fromWordId, toWordId, connectionType, note?}\` | 201 \`{connection}\`. **400** connecting a word to itself, **404** unknown word id (the message names which one), **403** unless you own *both* words, **409** that typed edge already exists. \`note\` <= 1000 chars |
| DELETE | /connections/:id | none | \`{ok: true}\`; 404 unknown, 403 unless you own both endpoint words |

**Ownership on connections is the real behavioral difference from the knowledge module**, whose \`/api/knowledge/connections\` twins do not check word ownership at all. Use this path when you want the check enforced, the knowledge path when you deliberately want to link words you did not create.

## Example

\`\`\`bash
API=https://shanebackend-production.up.railway.app/api/vocabulary

# see what is already in there before adding
curl "$API/languages"
curl "$API/words?language=spanish&limit=5"

# add a word and let the enricher fill in the rest
curl -X POST $API/words -H "Authorization: Bearer $PAT" -H "Content-Type: application/json" \\
  -d '{"word":"gracias","language":"spanish"}'
# -> 201 {"word":{"definition":"thank you","partOfSpeech":"interjection","labels":[...],...}}

# link it to its English translation (you must own both words)
curl -X POST $API/connections -H "Authorization: Bearer $PAT" -H "Content-Type: application/json" \\
  -d '{"fromWordId":"<ES_ID>","toWordId":"<EN_ID>","connectionType":"translation"}'
\`\`\`

\`GET /words/<ES_ID>\` then returns that edge in \`connections\` with the English row inlined in \`connectedWords\`, which is the cheapest way to walk the graph one hop.
`;
export default body;
