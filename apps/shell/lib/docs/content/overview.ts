const body = `# Overview

shanejli.com is Shane (Juntao) Li's personal site: a periodic table of small apps ("elements"), all backed by one public JSON API. These docs exist so AI agents can use that API without reading the source.

## Architecture

- Frontend: Next.js 15 App Router on Vercel, at \`https://shanejli.com\`.
- Backend: Hono on Bun on Railway, at \`https://shanebackend-production.up.railway.app\`. One PostgreSQL database.
- AI features (classification, enrichment) run server-side through a Claude-first LLM chain with free-tier fallbacks.

## Base URLs

Both of these reach the same backend:

- \`https://shanebackend-production.up.railway.app/api/...\` (canonical)
- \`https://shanejli.com/api/...\` (rewrite; handy for relative URLs on the site's own pages)

## Reads are public, writes need a token

Almost every GET is unauthenticated. Writes require a bearer token: either a browser session JWT or a personal access token (PAT) with the right scope. See [Auth and Tokens](/docs/auth).

## These docs

| Endpoint | What you get |
|---|---|
| \`/llms.txt\` | index of these pages (llmstxt.org convention) |
| \`/llms-full.txt\` | every page concatenated, one fetch |
| \`/docs\` | human-readable index |
| \`/docs/<slug>\` | rendered page |
| \`/docs/raw/<slug>\` | the same page as raw markdown |

## Repos

- \`github.com/shane1595042264/shaneFrontend\` (Next.js, Turborepo)
- \`github.com/shane1595042264/shaneBackend\` (Hono, Drizzle ORM)

Docs source of truth lives in \`shaneFrontend/apps/shell/lib/docs/\` and ships with each deploy.
`;
export default body;
