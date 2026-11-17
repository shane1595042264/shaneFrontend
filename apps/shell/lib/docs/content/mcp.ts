const body = `# MCP Server

The whole API as Model Context Protocol tools, so Claude Code, Claude Desktop or any other MCP client can read and write this site directly. One endpoint, \`https://shanejli.com/api/mcp\`, authenticated with the same personal access token as the HTTP API.

## Connect Claude Code

1. Mint a token at \`https://shanejli.com/settings/tokens\` with the scopes the agent should have. The dialog that shows the new token also shows this command with the token filled in.
2. Run it once:

\`\`\`bash
claude mcp add --transport http --scope user shanejli https://shanejli.com/api/mcp --header "Authorization: Bearer pat_..."
\`\`\`

3. Start a new Claude Code session and run \`/mcp\` to see the server and its tools. \`--scope user\` makes it available in every project; drop it to add the server to the current project only.

Any client that speaks Streamable HTTP works the same way: point it at the URL and send the token as \`Authorization: Bearer <token>\`. The Railway origin (\`https://shanebackend-production.up.railway.app/api/mcp\`) answers too.

## What the tools can do

Exactly what the token can do, no more. Every tool builds one ordinary API request and the server replays it with your token, so scopes, ownership rules, journal membership, validation and the per-token rate limits in [Auth and Tokens](/docs/auth) all apply unchanged. A write the token has no scope for comes back as a 403 that names the scope. Mint a token without write scopes for a read-only agent.

| Tool | What it does | Writes |
|---|---|---|
| \`whoami\` | the user the token belongs to | no |
| \`read_docs\` | these docs as markdown: the index, or one page by slug | no |
| \`knowledge_add_note\` | \`POST /api/knowledge/notes\`: free text in, a classified card out | yes, \`knowledge:write\` |
| \`knowledge_search\` | \`GET /api/knowledge/entries\` with search, category, label, language and location filters | no |
| \`knowledge_get\` | one card with its connections | no |
| \`journal_list\` | entries, newest first, with \`q\`, \`from\`, \`to\` and a date cursor | no |
| \`journal_get\` | one date's entry: body, version and appends | no |
| \`journal_create\` | the entry for a date (append-only afterwards) | yes, \`entries:write\` |
| \`journal_append\` | a section added to an entry you author | yes, \`entries:write\` |
| \`blog_list\` / \`blog_get\` | published posts / one post's full body | no |
| \`api_get\` | \`GET\` any \`/api/...\` path, with \`query\` | no |
| \`api_write\` | \`POST\`, \`PUT\`, \`PATCH\` or \`DELETE\` any \`/api/...\` path, with \`body\`, \`query\` and \`ifMatch\` | yes, per route |

\`api_get\` and \`api_write\` cover everything without a typed tool (trips, courses, scoreboard, vocabulary, practice, training plans, tea, skincare, comments, versions, suggestions). Reads and writes are separate tools so a client can allow \`api_get\` without asking each time while still confirming every write. Paths must start with \`/api/\`; \`.\` and \`..\` segments and \`/api/mcp\` itself are refused. The journal's If-Match routes take the version number as \`ifMatch\`: the server sends it as a real \`If-Match\` header, so the proxy problem described in [Conventions](/docs/conventions) does not arise here.

Every tool carries MCP annotations: the read tools are \`readOnlyHint: true\`, \`api_write\` is \`destructiveHint: true\`.

## Results

- A tool returns the route's JSON response body as text.
- A non-2xx answer is a tool error (\`isError: true\`) whose text starts with \`HTTP <status>\`, followed by the usual \`{error, details?}\` body.
- Arguments are checked against the tool's \`inputSchema\` before anything is sent. A bad call is a tool error listing each problem (\`arguments.date: does not match ...\`), so the model can correct it.
- Results longer than 60,000 characters are cut, with a note saying so. Use \`limit\`, filters or a cursor to fetch less.

## Protocol

- Streamable HTTP, stateless: every message is one \`POST\` with a JSON-RPC 2.0 body, and every answer is \`application/json\`. There is no SSE stream and no \`Mcp-Session-Id\`. \`GET\` and \`DELETE\` answer 405.
- Notifications are acknowledged with 202 and no body.
- Supported protocol versions: \`2025-11-25\`, \`2025-06-18\`, \`2025-03-26\` and \`2024-11-05\`. \`initialize\` echoes the one the client asks for, else answers \`2025-06-18\`.
- Capabilities: tools only. There are no resources, prompts or sampling.
- A missing, invalid or revoked token is a 401 with \`WWW-Authenticate: Bearer\`.
- A browser \`Origin\` from another site is 403; native clients send none.
- Batches of up to 20 messages are answered for older clients.
`;
export default body;
