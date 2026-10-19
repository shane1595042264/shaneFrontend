const body = `# AI and Reader Notes API

Bring-your-own-key AI for Explain, and private inline notes on blog posts and knowledge cards. Mounted at \`/api/ai\` and \`/api/reader-notes\`.

**Both are browser-session only.** Every route needs a signed-in session JWT; any PAT gets 403 whatever its scopes. These routes read which keys a person has and spend money on them, which is not something to hand to a script.

## Keys

| Method | Path | Notes |
|---|---|---|
| GET | /ai/keys | \`{keys, settings, providers}\`. Keys never include the secret: \`keyHint\` is its last four characters |
| POST | /ai/keys | \`{key}\`. Provider detected from the format, key checked, sealed, stored. One key per provider: adding a second replaces the first. 201 \`{key}\` |
| PATCH | /ai/keys/:id | \`{preferredModel: string or null}\`. Must be one of the key's \`models\`; null means the cheapest that works. 409 if the key was replaced or deleted while the request was in flight |
| POST | /ai/keys/:id/check | re-runs the check; updates \`models\`, \`defaultModel\`, \`status\`. If a new key for the provider was added during the check, the result is dropped and the current key is returned |
| DELETE | /ai/keys/:id | 204 |
| PATCH | /ai/settings | \`{preferredProvider?: provider or null, notesToKnowledge?: boolean}\`. Only the fields sent are written; 200 with the stored settings |

Supported formats: Google Gemini \`AIza\` + 35 characters, OpenAI \`sk-\`, Anthropic \`sk-ant-\`, xAI Grok \`xai-\`. Groq (\`gsk_\`), OpenRouter (\`sk-or-\`) and admin keys are refused with a reason that names them. An unrecognised format is 400 \`{error, code: "unknown_provider"}\`.

The check lists the key's models, keeps the text models, ranks them cheapest first by list price (or by tier name when the price is unknown), and spends one output token on each in turn until one answers, at most four. That model becomes \`defaultModel\`. Listing alone is not enough: an account with no credit lists models and fails every call, and a listed model can still refuse new users. Failures are 422 with \`code\` \`auth\` (key rejected), \`quota\` (valid key, account cannot pay) or \`no_models\`; 502 \`unreachable\` when the provider could not be reached. The check is recorded in usage as \`feature: "validate"\`.

## Explain

\`POST /api/ai/explain\` with \`{quote 1..600, before?, after? (each up to 2000 chars), title?, heading?, surface: "journal" | "blog" | "knowledge"}\`, strict. There is no prompt field: the server wraps the selection and its context in a fixed template. The site sends about 120 words before the selection and 80 after, cut at the edge of the part it is in, plus the page title and the nearest heading.

Key and model: the preferred provider's key if it is working, else the first working key added; that key's \`preferredModel\`, else its \`defaultModel\`. 200 \`{explanation, provider, model, usage: {inputTokens, outputTokens, costMicroUsd}}\`. 409 \`{code: "no_key"}\` when there is no working key; 502 \`{code: "provider", kind}\` when the provider refused (\`kind\` auth, quota, model, rate or other). An auth or quota refusal marks the key \`failing\`.

The answer is not stored by this route. The site saves it as a note on the selection, with \`meta: {kind: "ai", provider, model}\` (a journal comment, see [Journal API](/docs/journal-api), or a reader note below), and checks for such a note before calling Explain again on the same words.

## Usage

\`GET /api/ai/usage?days=1..365\` (default 30): \`{days, totals, byModel, daily, recent}\` over your own calls. Token counts are what the provider reported (Gemini's thinking tokens count as output). \`costMicroUsd\` is an estimate in millionths of a dollar from list prices, rounded per call.

## Reader notes

Inline notes on public pages, private to the reader who wrote them.

| Method | Path | Notes |
|---|---|---|
| GET | /reader-notes?surface=blog or knowledge&resource=:id | your notes on one blog post (post id) or knowledge card (card id), oldest first |
| POST | /reader-notes | \`{surface, resource, content 1..10000, anchor?, parentId?, meta?}\`, strict |
| DELETE | /reader-notes/:id | your own only; deletes its replies too |

A note needs \`anchor\` (\`{target, quote, prefix?, suffix?}\`, the same shape as journal inline notes, with \`target\` naming the part of the page: \`body\` on a post, \`definition\` or \`example\` on a card). A reply sets \`parentId\` to one of your own top-level notes on the same resource and carries no anchor or meta. \`meta\` is \`{kind: "ai", provider, model}\` on an Explain answer.

## Notes become knowledge cards

A new note, typed or explained, on any of the three surfaces is also handed to the knowledge classifier, which turns it into a card the same way \`POST /api/knowledge/notes\` does. Only the selected words and the note text go in, never the text around them: cards are public and a journal is not. Replies are not filed. Turn it off with \`PATCH /api/ai/settings {notesToKnowledge: false}\`.
`;
export default body;
