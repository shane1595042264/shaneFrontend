const body = `# Auth and Tokens

One bearer header, two credential kinds. The backend branches on the \`pat_\` prefix.

## Credential kinds

- **Session JWT**: minted by Google OAuth in the browser (sign in at shanejli.com). Full power: bypasses all scope checks and all per-minute rate limits.
- **Personal access token (PAT)**: \`pat_\` + 32 random bytes base64url. Scoped and rate limited. This is what agents should use.

Send either as \`Authorization: Bearer <token>\`.

## Minting a PAT

Easiest: sign in and mint at \`https://shanejli.com/settings/tokens\`.

Programmatic (requires a session JWT; a PAT can never mint another PAT, by design):

\`\`\`bash
curl -X POST https://shanebackend-production.up.railway.app/api/auth/tokens \\
  -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" \\
  -d '{"name":"my-agent","scopes":["entries:write","comments:write"]}'
# 201 {"id":"<uuid>","token":"pat_..."}   raw token shown exactly once
\`\`\`

- List: \`GET /api/auth/tokens\`. Revoke: \`DELETE /api/auth/tokens/:id\` (204).
- PATs never expire; revocation is the only kill switch.
- Who am I: \`GET /api/auth/me\` returns your user object for either credential kind.

## Scopes

\`entries:write\`, \`suggestions:write\`, \`comments:write\`, \`reactions:write\`, \`knowledge:write\`, \`trips:write\`, \`practice:write\`

A PAT without the required scope gets 403 \`Token missing required scope: <scope>\`. Some routes need only authentication, no scope (for example journal image uploads and the loans module).

## Rate limits (PATs only, rolling 60s, 429 + Retry-After)

| Bucket | Limit/min | Covers |
|---|---|---|
| journal-entries-write | 30 | entry create, append, revert, trash |
| journal-suggestions-write | 30 | suggest, approve, reject, withdraw |
| journal-comments-write | 30 | journal comments |
| journal-reactions-write | 60 | journal reactions |
| courses-write | 60 | all courses writes |
| scoreboard-write | 60 | all scoreboard writes |
| tea-entries-write | 30 | tea writes |
| skincare-write | 60 | skincare writes |
| knowledge-notes-single / -batch | 30 / 5 | note ingest |
| knowledge-entries-write | 30 | knowledge entry writes |
| vocabulary-writes / vocabulary-enrich | 30 / 10 | vocabulary writes / enrich |
| practice-* | 30 (sync and vocab reviews 120) | practice writes |
| rng-capitalist-evaluate / -plaid | 10 / 10 | rng evaluate / Plaid |

Journal image uploads have a separate 100 per rolling 24h per-user quota (applies to JWTs too) with an honest \`Retry-After\`.

## Admin-gated surfaces

A few routes are JWT-plus-admin-email only (practice settings PATCH, activity ingest). PATs always get 403 there; agents should skip them.
`;
export default body;
