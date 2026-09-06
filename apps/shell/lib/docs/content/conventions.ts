const body = `# API Conventions

One page of rules shared by every module, so the per-module docs stay short.

## Base URLs

- Backend origin: \`https://shanebackend-production.up.railway.app\`
- \`https://shanejli.com/api/*\` rewrites to the same backend (afterFiles rewrite), so relative \`/api/...\` URLs work from the site's own pages.

## Errors

Every error is JSON with a top-level \`error\` string — no exceptions. Unhandled throws return 500 \`{"error":"Internal Server Error"}\`; an unmatched route returns 404 \`{"error":"Not Found","path":"/api/nope"}\`.

Validation failures (bad params, query, or body) return 400 and add a structured \`details\` array alongside the summary:

\`\`\`json
{
  "error": "Validation failed: limit: Expected number, received nan; cursor: YYYY-MM-DD",
  "details": [
    { "path": "limit", "message": "Expected number, received nan" },
    { "path": "cursor", "message": "YYYY-MM-DD" }
  ]
}
\`\`\`

\`details[].path\` is the dot-joined field path (\`notes.0.text\` for array elements) and is omitted for object-level errors. \`error\` folds the first 5 issues into one readable line and appends \`(+N more)\`; \`details\` always carries every issue. Read \`details\` for field-level form errors, \`error\` when you just need one message to show.

## Auth posture

- Missing/invalid token on a protected route: 401.
- PAT lacking the required scope: 403 \`Token missing required scope: <scope>\`.
- A row that exists but is not yours: usually 404, not 403 (deliberately indistinct; loans is the exception and 403s).

## Wire format

- JSON bodies. Request field names are camelCase in most modules; the journal and comment surfaces use snake_case for multi-word request fields (\`parent_comment_id\`, \`base_version_num\`, \`target_version_num\`). Responses are camelCase everywhere.
- Dates that key resources are \`YYYY-MM-DD\` strings, validated as real calendar dates (2026-02-30 is a 400, not a 500).
- Free-text fields are trimmed before validation; whitespace-only input is a 400.

## Pagination

Most modules paginate by keyset, newest-first, via \`limit\` (1 to 100) and \`cursor\`. The cursor value differs by module: the journal cursor is the last entry's DATE (\`YYYY-MM-DD\`); trips, loans, tea, scoreboard matches, courses, and rng history use a \`createdAt\` ISO timestamp. Read \`nextCursor\` from each response; null means done.

Knowledge and vocabulary are the exception: they page by \`limit\` (1 to 500, default 100) and \`offset\`, and echo \`{ total, limit, offset }\` back so you can compute the page count up front. They have no \`nextCursor\`, so you are done when \`offset + limit >= total\`.

## Caching and conditional GET

Every 200 JSON response to a GET carries a weak validator, \`ETag: W/"..."\`, plus \`Cache-Control: private, no-cache\`. Send the validator back as \`If-None-Match\` on the next poll and an unchanged resource answers **304** with an empty body instead of re-sending the payload:

\`\`\`bash
BASE=https://shanebackend-production.up.railway.app
ETAG=$(curl -sD - -o /dev/null "$BASE/api/journal/entries" | grep -i '^etag:' | cut -d' ' -f2- | tr -d '\\r')
curl -s -o /dev/null -w '%{http_code} %{size_download}' -H "If-None-Match: $ETAG" "$BASE/api/journal/entries"
# 304 0
\`\`\`

- The tag is derived from the response body, so any change to the data changes the tag.
- It is *weak* because gzip is applied at the edge rather than by the API, so identical data ships as more than one byte sequence. Weak comparison is what \`If-None-Match\` uses anyway, so 304s still work.
- \`no-cache\` means "you may store it, but revalidate before reuse". It does not mean "do not store". \`private\` is there because responses vary by \`Authorization\` while \`Vary\` does not list it, so a shared cache must never reuse one across users.
- A comma-separated \`If-None-Match\` list and \`*\` both work, and \`"abc"\` matches \`W/"abc"\`.
- Image routes such as \`/api/journal/images/:id\` opt out. They are immutable and already ship \`Cache-Control: public, max-age=31536000, immutable\`.
- In a browser, read the header off \`response.headers.get("ETag")\`. It is listed in \`Access-Control-Expose-Headers\`, without which fetch() cannot see it.

## Optimistic concurrency (If-Match)

Racy journal mutations (revert, suggestion approve) require an \`If-Match\` header carrying the entry's current version number as a plain integer (from \`GET /api/journal/entries/:date\`, field \`currentVersionNum\`).

- Missing header: 428
- Non-numeric: 400
- Stale: 409 with \`{"error":"Version conflict","currentVersionNum":<latest>}\` so you can rebase and retry.

## Rate limits

Per-PAT rolling 60 second buckets (JWT browser sessions bypass); see the bucket table in [Auth and Tokens](/docs/auth). 429 responses carry \`Retry-After\`.

## CORS

Allowed request headers are \`Content-Type\`, \`Authorization\`, \`If-Match\`, \`If-None-Match\`, \`X-Tea-Pin\`. \`ETag\` is the one exposed response header. A new custom header needs a backend change; the symptom of forgetting is a browser-only "Failed to fetch".
`;
export default body;
